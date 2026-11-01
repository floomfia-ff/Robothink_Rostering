import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api.js'
import * as R from '../lib/roster.js'

const MAX_UNDO = 50
const RosterContext = createContext(null)
export const useRoster = () => useContext(RosterContext)

export function RosterProvider({ children }) {
  const [roster, setRoster] = useState(null) // { coaches, weeks }
  const [weekId, setWeekId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [swapTarget, setSwapTarget] = useState(null) // { dayKey, blockId, index? } — no index = add mode
  const [history, setHistory] = useState([]) // [{ roster, weekId }] before each change, newest last
  const lastEditKey = useRef(null)
  const [highlight, setHighlight] = useState('') // coach id picked in "Find coach"

  useEffect(() => {
    api.loadRoster().then((r) => {
      setRoster(r)
      setWeekId(r.weeks[0].id)
    })
  }, [])

  // Browser asks "Leave site?" when closing or refreshing with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!roster) return <p className="p-8 text-slate-500">Loading roster…</p>

  const week = roster.weeks.find((w) => w.id === weekId)
  const coaches = roster.coaches
  const coachById = Object.fromEntries(coaches.map((c) => [c.id, c]))

  // Save the current roster for Undo. Repeated edits with the same key (typing in one field) share one step.
  const remember = (key) => {
    if (!key || key !== lastEditKey.current) setHistory((h) => [...h.slice(1 - MAX_UNDO), { roster, weekId }])
    lastEditKey.current = key ?? null
  }

  // Every week change goes through here: clone the week and mutate the clone.
  // A published week stays published but is flagged until it's published again.
  const edit = (fn, key) => {
    remember(key)
    setRoster((r) => ({
      ...r,
      weeks: r.weeks.map((w) => {
        if (w.id !== weekId) return w
        const copy = structuredClone(w)
        fn(copy)
        if (copy.status === 'published') copy.changedSincePublish = true
        return copy
      }),
    }))
    setDirty(true)
  }

  // Changes that aren't tied to one week (coach profiles, venues).
  const editRoster = (fn, key) => {
    remember(key)
    setRoster((r) => {
      const copy = structuredClone(r)
      fn(copy)
      return copy
    })
    setDirty(true)
  }
  const blockIn = (w, dayKey, blockId) => w.days.find((x) => x.key === dayKey).blocks.find((b) => b.id === blockId)

  const run = async (label, fn) => {
    try {
      await fn()
      setDirty(false)
      setNotice(`${label} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
    } catch (e) {
      setNotice(`${label} failed: ${e.message}`)
    }
  }

  const value = {
    coaches, coachById, week, weekId, weeks: roster.weeks, venues: R.venueList(roster), dirty, notice,
    setWeekId, swapTarget, setSwapTarget,
    openSwap: (dayKey, blockId, index) => setSwapTarget({ dayKey, blockId, index }),
    closeSwap: () => setSwapTarget(null),
    assignCoach: (d, b, i, id) => edit((w) => R.assignCoach(w, d, b, i, id)),
    addCoach: (d, b, id) => edit((w) => R.addCoach(w, d, b, id)),
    removeCoach: (d, b, i) => edit((w) => R.removeCoach(w, d, b, i)),
    setRole: (d, b, i, role) => edit((w) => R.setRole(w, d, b, i, role)),
    setAvailability: (d, id, s) => edit((w) => R.setAvailability(w, d, id, s)),
    updateSlot: (d, blockId, i, patch) =>
      edit((w) => Object.assign(blockIn(w, d, blockId).slots[i], patch), `slot:${blockId}:${i}:${Object.keys(patch)}`),
    addSlot: (d, blockId) => edit((w) => blockIn(w, d, blockId).slots.push({ time: '', students: 0 })),
    removeSlot: (d, blockId, i) => edit((w) => blockIn(w, d, blockId).slots.splice(i, 1)),
    addBlock: (d, name, base) => edit((w) => R.addBlock(w, d, name, base)),
    removeBlock: (d, blockId) => edit((w) => R.removeBlock(w, d, blockId)),
    setNoLesson: (d, blockId, on) => edit((w) => R.setNoLesson(w, d, blockId, on)),
    removeVenue: (name) => editRoster((r) => (r.venues = (r.venues ?? []).filter((v) => v.name !== name))),
    highlight, setHighlight,
    // Venues are keyed by name, so renaming a venue in the roster starts a fresh entry.
    updateVenue: (name, patch) =>
      editRoster((r) => {
        r.venues ??= []
        let v = r.venues.find((x) => x.name === name)
        if (!v) r.venues.push((v = { name, address: '', postalCode: '' }))
        Object.assign(v, patch)
      }, `venue:${name}:${Object.keys(patch)}`),
    updateCoach: (id, patch) =>
      editRoster((r) => Object.assign(r.coaches.find((c) => c.id === id), patch), `coach:${id}:${Object.keys(patch)}`),
    createCoach: () =>
      editRoster((r) => {
        const id = `coach-${Date.now()}`
        r.coaches.push({ id, name: '', type: 'intern', mrt: '' })
        // New coaches start unavailable every day; set their days in the availability panel.
        for (const w of r.weeks) w.availability[id] = w.days.map(() => 'unavailable')
      }),
    deleteCoach: (id) =>
      editRoster((r) => {
        r.coaches = r.coaches.filter((c) => c.id !== id)
        for (const w of r.weeks) {
          delete w.availability[id]
          for (const d of w.days) for (const b of d.blocks) b.coaches = b.coaches.filter((c) => c.id !== id)
        }
      }),
    autoGenerate: () => {
      edit((w) => R.autoFill(w, coaches))
      setNotice('Draft auto-generated — review, then save')
    },
    createWeek: () => {
      const next = R.nextWeek(week, roster.weeks.at(-1))
      remember()
      setRoster((r) => ({ ...r, weeks: [...r.weeks, next] }))
      setWeekId(next.id)
      setDirty(true)
      setNotice(`Created ${next.label} from ${week.label}`)
    },
    canUndo: history.length > 0,
    undo: () => {
      const prev = history.at(-1)
      if (!prev) return
      setHistory((h) => h.slice(0, -1))
      lastEditKey.current = null
      setRoster(prev.roster)
      setWeekId(prev.weekId) // back to the week the change was made on
      setDirty(true)
      setNotice('Undone')
    },
    saveDraft: () => run('Draft saved', () => api.saveDraft(roster)),
    publish: () => {
      const next = {
        ...roster,
        weeks: roster.weeks.map((w) => (w.id === weekId ? { ...w, status: 'published', changedSincePublish: false } : w)),
      }
      setRoster(next)
      return run('Published', () => api.publishRoster(next, weekId))
    },
    resetToMock: async () => {
      api.resetToMock()
      const r = await api.loadRoster()
      setRoster(r)
      setWeekId(r.weeks[0].id)
      setHistory([])
      setDirty(false)
      setNotice('Reset to mock data')
    },
  }

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>
}
