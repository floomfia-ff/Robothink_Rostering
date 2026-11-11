import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api.js'
import * as R from '../lib/roster.js'
import { currentMonday } from '../../supabase/functions/roster/logic.js'

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
  if (!roster) return <LoadingScreen />

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
  // `undone`: the caller put the screen back, so the message says it wasn't saved.
  const run = async (doing, fn, undone = false) => {
    if (busy) return false
    setBusy(doing)
    try {
      await fn()
      return true
    } catch (e) {
      say(`${doing} failed: ${e.message || 'unknown error'}. ${undone ? "It wasn't saved." : 'Your changes are still here — try again.'}`, true)
      return false
    } finally {
      setBusy('')
    }
  }

  // An older week arrives as a stub ({ archived: true }); it is loaded in full before it is shown.
  const openWeek = (id) => {
    if (!roster.weeks.find((w) => w.id === id)?.archived) return setWeekId(id)
    return run('Loading', async () => {
      const full = await api.openArchivedWeek(id)
      setRoster((r) => ({ ...r, weeks: r.weeks.map((w) => (w.id === id ? full : w)) }))
      setWeekId(id)
    })
  }

  const value = {
    coaches, coachById, week, weekId, weeks: roster.weeks, deletedWeeks: roster.deletedWeeks ?? [], rules: roster.rules ?? [], schools: roster.schools, venues: R.venueList(roster), planError: roster.planError, unmatchedSchools: roster.unmatchedSchools, travelTimes: roster.travelTimes ?? {}, unrecognisedStations: roster.unrecognisedStations ?? [], dirty, notice, noticeError, busy, saving,
    setWeekId: openWeek,
    swapTarget, setSwapTarget,
    openSwap: (dayKey, blockId, index) => setSwapTarget({ dayKey, blockId, index }),
    closeSwap: () => setSwapTarget(null),
    assignCoach: (d, b, i, id) => edit((w) => R.assignCoach(w, d, b, i, id)),
    addCoach: (d, b, id) => edit((w) => R.addCoach(w, d, b, id)),
    removeCoach: (d, b, i) => edit((w) => R.removeCoach(w, d, b, i)),
    setRole: (d, b, i, role) => edit((w) => R.setRole(w, d, b, i, role)),
    // An intern's day off (or back on) carries into every later week too, so it only needs setting once.
    setAvailability: (d, id, s) => {
      const intern = coachById[id]?.employment_type === 'intern'
      setRoster((r) => ({
        ...r,
        weeks: r.weeks.map((w) => {
          if (w.archived || (w.id !== weekId && !(intern && w.id > weekId))) return w
          const copy = structuredClone(w)
          R.setAvailability(copy, d, id, s)
          return copy
        }),
      }))
      setDirty(true)
    },
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
        const filled = await api.generateRoster(week, coaches, roster.travelTimes ?? {}, roster.rules ?? [])
        const diff = R.diffAssignments(week, filled)
        edit((w) => Object.assign(w, { days: filled.days, availability: filled.availability })) // days off it set, too
        setChanges({ weekId: week.id, ...diff, keys: new Set([...diff.added, ...diff.newLeads]) })
        say('Auto-generated — review it')
      }),
    // Asks the server for batches until nothing is left; each reply carries the fresh times. Only those two
    // fields change, so the save baseline and anything on screen are untouched.
    refreshTravelTimes: async (onProgress) => {
      try {
        for (;;) {
          const { done, remaining, total, travelTimes, unrecognisedStations } = await api.refreshTravelTimes()
          onProgress(total - remaining, total)
          setRoster((r) => ({ ...r, travelTimes, unrecognisedStations }))
          if (!remaining || !done) break
        }
        say('Travel times up to date')
        return true
      } catch (e) {
        say(`Travel times: ${e.message || 'unknown error'}`, true)
        return false
      }
    },
    // Rules tab. Each change shows at once; if the server refuses it, the old rules come back with the error.
    addRule: (rule) =>
      run('Saving rule', async () => {
        const { id } = await api.createRule(rule)
        setRoster((r) => ({ ...r, rules: [...(r.rules ?? []), { active: true, note: null, coach_id: null, school_id: null, value: null, ...rule, id }] }))
        say('Rule added')
      }),
    // Busy means another server call is running and this one would be dropped, so nothing changes on screen.
    updateRule: (id, patch) => {
      if (busy) return Promise.resolve(false)
      const before = roster.rules
      setRoster((r) => ({ ...r, rules: r.rules.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      return run('Saving rule', async () => {
        try {
          await api.updateRule(id, patch)
        } catch (e) {
          setRoster((r) => ({ ...r, rules: before }))
          throw e
        }
        say('Rule saved')
      }, true)
    },
    removeRule: (id) => {
      if (busy) return Promise.resolve(false)
      const before = roster.rules
      setRoster((r) => ({ ...r, rules: r.rules.filter((x) => x.id !== id) }))
      return run('Removing rule', async () => {
        try {
          await api.deleteRule(id)
        } catch (e) {
          setRoster((r) => ({ ...r, rules: before }))
          throw e
        }
        say('Rule removed')
      }, true)
    },
    // `id` is the week's Monday. A week that's already there is just opened.
    createWeek: (id) => {
      if (roster.weeks.some((w) => w.id === id)) {
        openWeek(id) // an archived stub is loaded first
        return Promise.resolve(true)
      }
      return run('Creating', async () => {
        const next = await api.loadWeek(id)
        // a new week on a deleted week's date replaces that deleted copy when it saves
        setRoster((r) => ({
          ...r,
          weeks: [...r.weeks, next].sort((a, b) => a.id.localeCompare(b.id)),
          deletedWeeks: (r.deletedWeeks ?? []).filter((w) => w.id !== next.id),
        }))
        setWeekId(next.id)
        setDirty(true)
        say(`Created ${next.label}`)
      })
    },
    // Leaves the neighbouring week open. Opening the site again re-creates the current week empty if it was deleted.
    deleteWeek: () =>
      run('Deleting', async () => {
        await api.deleteWeek(week.id)
        const i = roster.weeks.findIndex((w) => w.id === week.id)
        setRoster((r) => ({
          ...r,
          weeks: r.weeks.filter((w) => w.id !== week.id),
          deletedWeeks: [{ id: week.id, label: week.label }, ...(r.deletedWeeks ?? []).filter((w) => w.id !== week.id)],
        }))
        // Prefer a loaded neighbour; if only older stubs are left, load the nearest one in full first.
        const others = roster.weeks.filter((w) => w.id !== week.id)
        const loaded = roster.weeks.slice(i + 1).find((w) => !w.archived) ?? roster.weeks.slice(0, i).findLast((w) => !w.archived)
        const nearest = loaded ?? others.at(-1)
        if (nearest?.archived) {
          const full = await api.openArchivedWeek(nearest.id)
          setRoster((r) => ({ ...r, weeks: r.weeks.map((w) => (w.id === nearest.id ? full : w)) }))
        }
        if (nearest) setWeekId(nearest.id)
        say(`Deleted ${week.label}`)
      }),
    restoreWeek: (id) =>
      run('Restoring', async () => {
        const back = await api.restoreWeek(id)
        setRoster((r) => ({
          ...r,
          weeks: [...r.weeks.filter((w) => w.id !== id), back].sort((a, b) => a.id.localeCompare(b.id)),
          deletedWeeks: r.deletedWeeks.filter((w) => w.id !== id),
        }))
        setWeekId(id)
        say(`Restored ${back.label}`)
      }),
  }

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>
}

// Shown until the roster arrives; after 5 s it explains the wait (the server sleeps when nobody has used it for a while).
function LoadingScreen() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-100 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src="/robothink-logo.png" alt="RoboThink" className="h-12 w-auto" />
        <span className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 motion-reduce:animate-none" aria-hidden="true" />
        <p className="font-semibold text-slate-700">Loading roster…</p>
        {slow && <p className="max-w-xs text-sm text-slate-500">Waking the server up — this can take a few seconds after a quiet spell.</p>}
      </div>
    </div>
  )
}
