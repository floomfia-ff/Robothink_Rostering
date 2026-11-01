import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api.js'
import * as R from '../lib/roster.js'
import { addDays, currentMonday } from '../../supabase/functions/roster/logic.js'

const MAX_UNDO = 50
const RosterContext = createContext(null)
export const useRoster = () => useContext(RosterContext)

export function RosterProvider({ children }) {
  const [roster, setRoster] = useState(null) // { coaches, schools, bases, weeks, planError, unmatchedSchools }
  const [weekId, setWeekId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [busy, setBusy] = useState('') // 'Saving' | 'Publishing' | 'Generating' | 'Creating' while a server call runs
  const [loadError, setLoadError] = useState('')
  const [swapTarget, setSwapTarget] = useState(null) // { dayKey, blockId, index? } — no index = add mode
  const [history, setHistory] = useState([]) // [{ roster, weekId }] before each change, newest last
  const lastEditKey = useRef(null)
  const [highlight, setHighlight] = useState('') // coach id picked in "Find coach"
  const [dragging, setDragging] = useState(null) // { dayKey, coachId } while a chip is dragged
  const [changes, setChanges] = useState(null) // last Auto-Generate: { weekId, added, removed, newLeads, keys }

  const load = () => {
    setLoadError('')
    api
      .loadRoster()
      .then((r) => {
        setRoster(r)
        setWeekId((r.weeks.find((w) => w.id === currentMonday(new Date())) ?? r.weeks.at(-1)).id)
      })
      .catch((e) => setLoadError(e.message || 'Unknown error'))
  }
  useEffect(load, [])

  // Browser asks "Leave site?" when closing or refreshing with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (loadError) {
    return (
      <div role="alert" className="m-8 max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Couldn't load the roster.</p>
        <p className="mt-1">{loadError}</p>
        <button type="button" onClick={load} className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700">
          Try again
        </button>
      </div>
    )
  }
  if (!roster) return <p className="p-8 text-slate-500">Loading roster…</p>

  const week = roster.weeks.find((w) => w.id === weekId)
  const coachById = Object.fromEntries(roster.coaches.map((c) => [c.id, c]))
  const coaches = roster.coaches.filter((c) => c.active)

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

  const say = (text, error = false) => {
    setNotice(text)
    setNoticeError(error)
  }
  // One server call at a time. On failure nothing is marked saved, so the admin can just retry.
  const run = async (doing, fn) => {
    if (busy) return false
    setBusy(doing)
    try {
      await fn()
      return true
    } catch (e) {
      say(`${doing} failed: ${e.message || 'unknown error'}. Your changes are still here — try again.`, true)
      return false
    } finally {
      setBusy('')
    }
  }
  const savedAt = (label) => {
    setDirty(false)
    say(`${label} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
  }

  const value = {
    coaches, coachById, week, weekId, weeks: roster.weeks, venues: R.venueList(roster), planError: roster.planError, unmatchedSchools: roster.unmatchedSchools, dirty, notice, noticeError, busy,
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
    dragging, setDragging,
    moveCoach: (d, coachId, toBlockId) => edit((w) => R.moveCoach(w, d, coachId, toBlockId)),
    changes: changes?.weekId === weekId ? changes : null,
    clearChanges: () => setChanges(null),
    highlight, setHighlight,
    updateVenue: (kind, id, patch) =>
      editRoster((r) => Object.assign(r[kind === 'school' ? 'schools' : 'bases'].find((v) => v.id === id), patch), `venue:${kind}:${id}:${Object.keys(patch)}`),
    updateCoach: (id, patch) =>
      editRoster((r) => Object.assign(r.coaches.find((c) => c.id === id), patch), `coach:${id}:${Object.keys(patch)}`),
    // Applies to the week that was open when clicked, even if the admin switches weeks meanwhile.
    autoGenerate: () =>
      run('Generating', async () => {
        const filled = await api.generateRoster(week, coaches)
        const diff = R.diffAssignments(week, filled)
        edit((w) => (w.days = filled.days))
        setChanges({ weekId: week.id, ...diff, keys: new Set([...diff.added, ...diff.newLeads]) })
        say('Draft auto-generated — review, then save')
      }),
    createWeek: () =>
      run('Creating', async () => {
        const next = await api.loadWeek(addDays(roster.weeks.at(-1).id, 7))
        remember()
        setRoster((r) => ({ ...r, weeks: [...r.weeks, next] }))
        setWeekId(next.id)
        say(`Created ${next.label}`)
      }),
    canUndo: history.length > 0,
    undo: () => {
      const prev = history.at(-1)
      if (!prev) return
      setHistory((h) => h.slice(0, -1))
      lastEditKey.current = null
      setRoster(prev.roster)
      setWeekId(prev.weekId) // back to the week the change was made on
      setChanges(null)
      setDirty(true)
      say('Undone')
    },
    saveDraft: async () => (await run('Saving', () => api.saveDraft(roster))) && savedAt('Draft saved'),
    // Marked published only once the server says so.
    publish: async () => {
      const next = {
        ...roster,
        weeks: roster.weeks.map((w) => (w.id === weekId ? { ...w, status: 'published', changedSincePublish: false } : w)),
      }
      if (await run('Publishing', () => api.publishRoster(next, weekId))) {
        setRoster(next)
        savedAt('Published')
      }
    },
  }

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>
}
