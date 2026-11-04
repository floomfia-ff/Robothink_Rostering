import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api.js'
import * as R from '../lib/roster.js'
import { addDays, currentMonday } from '../../supabase/functions/roster/logic.js'

const RosterContext = createContext(null)
export const useRoster = () => useContext(RosterContext)

export function RosterProvider({ children }) {
  const [roster, setRoster] = useState(null) // { coaches, schools, bases, weeks, planError, unmatchedSchools }
  const [weekId, setWeekId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [busy, setBusy] = useState('') // 'Generating' | 'Creating' while a server call runs
  const [saving, setSaving] = useState('') // '' | 'saving' | 'saved' | an error message
  const [retry, setRetry] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [swapTarget, setSwapTarget] = useState(null) // { dayKey, blockId, index? } — no index = add mode
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

  // Changes save themselves a second after the last edit. Edits made while a save runs go out with the next
  // one (only what differs from the server is sent); a failed save keeps the changes and retries in 10 seconds.
  const latest = useRef(roster)
  latest.current = roster
  useEffect(() => {
    if (!dirty || !roster) return
    const timer = setTimeout(async () => {
      const snapshot = roster
      setSaving('saving')
      try {
        await api.saveDraft(snapshot)
        if (latest.current === snapshot) setDirty(false)
        setSaving('saved')
      } catch (e) {
        setSaving(`Couldn't save: ${e.message || 'unknown error'}. Your changes are kept and will be retried.`)
        setTimeout(() => setRetry((n) => n + 1), 10000)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [roster, dirty, retry])

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

  // Every week change goes through here: clone the week and mutate the clone.
  const edit = (fn) => {
    setRoster((r) => ({
      ...r,
      weeks: r.weeks.map((w) => {
        if (w.id !== weekId) return w
        const copy = structuredClone(w)
        fn(copy)
        return copy
      }),
    }))
    setDirty(true)
  }

  // Changes that aren't tied to one week (coach profiles, venues).
  const editRoster = (fn) => {
    setRoster((r) => {
      const copy = structuredClone(r)
      fn(copy)
      return copy
    })
    setDirty(true)
  }

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

  const value = {
    coaches, coachById, week, weekId, weeks: roster.weeks, venues: R.venueList(roster), planError: roster.planError, unmatchedSchools: roster.unmatchedSchools, travelTimes: roster.travelTimes ?? {}, unrecognisedStations: roster.unrecognisedStations ?? [], dirty, notice, noticeError, busy, saving,
    setWeekId, swapTarget, setSwapTarget,
    openSwap: (dayKey, blockId, index) => setSwapTarget({ dayKey, blockId, index }),
    closeSwap: () => setSwapTarget(null),
    assignCoach: (d, b, i, id) => edit((w) => R.assignCoach(w, d, b, i, id)),
    addCoach: (d, b, id) => edit((w) => R.addCoach(w, d, b, id)),
    removeCoach: (d, b, i) => edit((w) => R.removeCoach(w, d, b, i)),
    setRole: (d, b, i, role) => edit((w) => R.setRole(w, d, b, i, role)),
    setAvailability: (d, id, s) => edit((w) => R.setAvailability(w, d, id, s)),
    clearCoaches: () => {
      edit((w) => R.clearCoaches(w))
      setChanges(null)
      say('All coaches cleared')
    },
    addBlock: (d, name, base) => edit((w) => R.addBlock(w, d, name, base)),
    removeBlock: (d, blockId) => edit((w) => R.removeBlock(w, d, blockId)),
    setNoLesson: (d, blockId, on) => edit((w) => R.setNoLesson(w, d, blockId, on)),
    dragging, setDragging,
    moveCoach: (d, coachId, toBlockId) => edit((w) => R.moveCoach(w, d, coachId, toBlockId)),
    changes: changes?.weekId === weekId ? changes : null,
    clearChanges: () => setChanges(null),
    highlight, setHighlight,
    updateVenue: (kind, id, patch) =>
      editRoster((r) => Object.assign(r[kind === 'school' ? 'schools' : 'bases'].find((v) => v.id === id), patch)),
    updateCoach: (id, patch) => editRoster((r) => Object.assign(r.coaches.find((c) => c.id === id), patch)),
    // Applies to the week that was open when clicked, even if the admin switches weeks meanwhile.
    autoGenerate: () =>
      run('Generating', async () => {
        const filled = await api.generateRoster(week, coaches, roster.travelTimes ?? {})
        const diff = R.diffAssignments(week, filled)
        edit((w) => Object.assign(w, { days: filled.days, availability: filled.availability })) // days off it set, too
        setChanges({ weekId: week.id, ...diff, keys: new Set([...diff.added, ...diff.newLeads]) })
        say('Auto-generated — review it')
      }),
    // Asks the server for batches until nothing is left, then picks up the new times (edits on screen are kept).
    refreshTravelTimes: async (onProgress) => {
      try {
        for (;;) {
          const { done, remaining, total } = await api.refreshTravelTimes()
          onProgress(total - remaining, total)
          if (!remaining || !done) break
        }
        const fresh = await api.loadRoster()
        setRoster((r) => ({ ...r, travelTimes: fresh.travelTimes, unrecognisedStations: fresh.unrecognisedStations }))
        say('Travel times up to date')
        return true
      } catch (e) {
        say(`Travel times: ${e.message || 'unknown error'}`, true)
        return false
      }
    },
    createWeek: () =>
      run('Creating', async () => {
        const next = await api.loadWeek(addDays(roster.weeks.at(-1).id, 7))
        setRoster((r) => ({ ...r, weeks: [...r.weeks, next] }))
        setWeekId(next.id)
        setDirty(true)
        say(`Created ${next.label}`)
      }),
  }

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>
}
