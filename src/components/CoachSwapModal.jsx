import { useEffect, useRef } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import { coachDay, needsLead } from '../lib/roster.js'
import CoachChip from './CoachChip.jsx'

const ROLES = [
  ['lead', '* Lead'],
  ['coach', 'Coach'],
  ['shadow', '# Shadow'],
]

export default function CoachSwapModal() {
  const { swapTarget, closeSwap, week, coaches, coachById, assignCoach, addCoach, removeCoach, setRole, travelTimes } = useRoster()
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!swapTarget) return
    dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && closeSwap()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // only re-run when a new target opens, so focus doesn't jump on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapTarget])

  if (!swapTarget) return null
  const { dayKey, blockId, index } = swapTarget
  const day = week.days.find((d) => d.key === dayKey)
  const block = day?.blocks.find((b) => b.id === blockId)
  const current = index === undefined ? null : block?.coaches[index]
  if (!block || (index !== undefined && !current)) return null // target vanished (e.g. week switched)

  const inBlock = new Set(block.coaches.map((c) => c.id))
  // Weekday lessons: within each group, nearest first by travel time; unknown times last.
  const lesson = block.kind === 'lesson'
  const minutes = (id) => (lesson ? travelTimes[id]?.[block.schoolId] : undefined)
  const far = (id) => minutes(id) ?? Infinity
  const candidates = coaches
    .filter((c) => !inBlock.has(c.id))
    .map((c) => ({ coach: c, day: coachDay(week, dayKey, c) }))
    .sort((a, b) => rank(a.day) - rank(b.day) || (far(a.coach.id) === far(b.coach.id) ? 0 : far(a.coach.id) - far(b.coach.id)))

  const pick = (id) => {
    if (current) assignCoach(dayKey, blockId, index, id)
    else addCoach(dayKey, blockId, id)
    closeSwap()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={closeSwap}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="swap-title" className="text-lg font-semibold text-slate-900">
              {current ? 'Swap coach' : 'Add coach'}
            </h2>
            <p className="text-sm text-slate-500">
              {block.name} · {day.label} {day.date}
            </p>
          </div>
          <button type="button" onClick={closeSwap} aria-label="Close" className="rounded p-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ×
          </button>
        </header>

        {current && (
          <div className="space-y-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <CoachChip coach={coachById[current.id]} role={current.role} />
              <button
                type="button"
                onClick={() => {
                  removeCoach(dayKey, blockId, index)
                  closeSwap()
                }}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Remove from venue
              </button>
            </div>
            <div role="radiogroup" aria-label="Role" className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {ROLES.filter(([role]) => role !== 'lead' || needsLead(block)).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={current.role === role}
                  onClick={() => setRole(dayKey, blockId, index, role)}
                  className={`flex-1 rounded-md px-2 py-1 text-sm font-medium ${
                    current.role === role ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{current ? 'Replace with' : 'Choose coach'}</h3>
          <ul className="space-y-1">
            {candidates.map(({ coach, day: s }) => {
              const blocked = s.status === 'off' || s.status === 'unavailable'
              const note = blocked
                ? s.status === 'off' ? 'Requested off' : 'Unavailable'
                : s.status === 'free' ? 'Free'
                : s.where === 'WCP' ? 'At WCP'
                : `At ${s.where} — ${current ? 'will swap' : 'will move'}`
              return (
                <li key={coach.id}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(coach.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <span className="font-medium text-slate-800">
                      {coach.name} <span className="text-xs font-normal text-slate-400">{coach.employment_type}</span>
                      {lesson && (
                        <span className="block text-xs font-normal text-slate-500">
                          {coach.mrt_station || 'No MRT'} · {minutes(coach.id) == null ? '—' : `${minutes(coach.id)} min`}
                        </span>
                      )}
                    </span>
                    <span className={`text-xs ${blocked ? 'text-slate-500' : s.where && s.where !== 'WCP' ? 'text-amber-700' : 'text-emerald-700'}`}>{note}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Free / at WCP first, then coaches at other venues, then OFF / X.
const rank = (s) => (s.status === 'free' || s.where === 'WCP' ? 0 : s.status === 'assigned' ? 1 : 2)
