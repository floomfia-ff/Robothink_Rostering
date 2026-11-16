import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import { coachDay, dayTotals } from '../lib/roster.js'
import { addDays } from '../../supabase/functions/roster/logic.js'
import { GRID_COLS } from './WeeklyGrid.jsx'

const NEXT = { available: 'off', off: 'unavailable', unavailable: 'available' }
// Working days stand out; empty days are pale so they fade back.
const CELL = {
  assigned: { text: '', cls: 'bg-emerald-50 text-emerald-800' },
  free: { text: '–', cls: 'bg-amber-50 text-amber-700' },
  off: { text: 'OFF', cls: 'bg-slate-100 text-slate-500' },
  unavailable: { text: 'X', cls: 'bg-slate-200/70 text-slate-400' },
}
const LEGEND = [
  ['assigned', 'Toa Payoh', 'placed (venue shown)'],
  ['free', '–', 'available, not placed'],
  ['off', 'OFF', 'requested off'],
  ['unavailable', 'X', 'unavailable'],
]

// "MBR Toa Payoh (Thu)" → "Toa Payoh": the brand is the same for most schools and the day is the column.
export const shortVenue = (name) =>
  String(name ?? '')
    .replace(/^(MBR|SPL|ASH)\s+/i, '')
    .replace(/\s*\((Mon|Tue|Wed|Thu|Fri|Sat|Sun)\)\s*$/i, '')

const STICKY_NAME = 'sticky left-0 z-20' // coach names stay in view when the table scrolls sideways

export default function AvailabilityPanel() {
  const { week, coaches } = useRoster()
  const totals = week.days.map((d) => dayTotals(week, d.key, coaches))
  const sgToday = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) // Singapore date
  const today = week.days.findIndex((_, i) => addDays(week.id, i) === sgToday)
  const partTimers = coaches.filter((c) => c.employment_type !== 'intern')

  return (
    <section aria-label="Coach availability" className="relative mt-4 grid min-w-[1380px] border-r border-b border-slate-200 text-xs" style={GRID_COLS}>
      {/* Same yellow outline as the roster above. */}
      {today >= 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 top-[30px] z-10 rounded-sm border-[3px] border-amber-400 print:hidden"
          style={{ left: `calc(120px + (100% - 120px) * ${today} / 7)`, width: 'calc((100% - 120px) / 7)' }}
        />
      )}

      {/* Title and legend first, so OFF / X / – are clear before reading the table. */}
      <div className="col-span-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-2 py-1.5">
        <h2 className={`${STICKY_NAME} bg-white pr-2 text-sm font-bold text-slate-900`}>Coach availability</h2>
        {LEGEND.map(([k, sample, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${CELL[k].cls}`}>{sample}</span>
            {label}
          </span>
        ))}
        <span className="text-[11px] text-slate-400">· Click a cell to change availability.</span>
      </div>

      {/* Day headers stay in view while scrolling down the table. */}
      <div className={`${STICKY_NAME} top-0 z-30 border-t border-slate-600 bg-slate-800 px-2 py-1 font-bold text-white`}>Coach</div>
      {week.days.map((d, i) => (
        <div key={d.key} className="sticky top-0 z-20 border-t border-l border-slate-600 bg-slate-800 px-2 py-1 text-center font-bold text-white">
          {d.label} <span className="font-normal text-slate-300">{d.date}</span>
          {i === today && <span className="ml-1 rounded bg-amber-400 px-1 text-[9px] font-bold text-slate-900">TODAY</span>}
        </div>
      ))}

      <div className={`${STICKY_NAME} border-t border-slate-200 bg-slate-50 px-2 py-1 font-bold text-slate-700`}>Total Coaches</div>
      {totals.map((t, i) => (
        <div key={i} className="border-t border-l border-slate-200 bg-yellow-200 px-2 py-0.5 text-right text-base font-bold text-slate-900">{t.assigned}</div>
      ))}

      <div className={`${STICKY_NAME} border-t border-slate-200 bg-slate-50 px-2 py-1 font-bold text-slate-700`}>Coaches Available</div>
      {totals.map((t, i) => (
        <div key={i} className="border-t border-l border-slate-200 bg-white px-2 py-1 text-right text-sm font-bold text-slate-800">{t.available}</div>
      ))}

      <Group title="Interns" list={coaches.filter((c) => c.employment_type === 'intern')} />
      <Group title="Part-Timers" list={partTimers} foldIdle />
    </section>
  )
}

// foldIdle: coaches who are X all seven days are tucked into one line, shown on request.
function Group({ title, list, foldIdle = false }) {
  const { week, setAvailability } = useRoster()
  const [showIdle, setShowIdle] = useState(false)
  const idle = foldIdle ? list.filter((c) => week.days.every((d) => coachDay(week, d.key, c).status === 'unavailable')) : []
  const shown = showIdle ? list : list.filter((c) => !idle.includes(c))

  return (
    <>
      <div className="col-span-8 border-t border-slate-200 bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
        <span className={`${STICKY_NAME} bg-slate-200`}>{title}</span>
      </div>
      {shown.map((coach) => (
        <div key={coach.id} className="contents">
          <div className={`${STICKY_NAME} truncate border-t border-slate-200 bg-slate-50 px-2 py-0.5 text-[13px] leading-5 text-slate-800`}>{coach.name}</div>
          {week.days.map((d) => {
            const s = coachDay(week, d.key, coach)
            const cell = CELL[s.status]
            const raw = s.status === 'assigned' || s.status === 'free' ? 'available' : s.status
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setAvailability(d.key, coach.id, NEXT[raw])}
                title={s.where ? `${coach.name}: ${s.where}` : `${coach.name}: ${s.status}`}
                aria-label={`${coach.name} ${d.label}: ${s.where ?? s.status}. Click to change.`}
                className={`flex items-center justify-between gap-1 border-t border-l border-slate-200 px-2 py-0.5 leading-5 hover:brightness-95 ${cell.cls}`}
              >
                <span className="truncate font-medium">{s.where ? shortVenue(s.where) : ''}</span>
                {cell.text && <span className="shrink-0 font-semibold">{cell.text}</span>}
              </button>
            )
          })}
        </div>
      ))}
      {idle.length > 0 && (
        <button
          type="button"
          onClick={() => setShowIdle((v) => !v)}
          className="col-span-8 border-t border-slate-200 bg-white px-2 py-1 text-left text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          <span className={`${STICKY_NAME} bg-inherit`}>
            {showIdle
              ? `Hide the ${idle.length} part-timer${idle.length === 1 ? '' : 's'} not available this week`
              : `${idle.length} part-timer${idle.length === 1 ? '' : 's'} not available this week (show)`}
          </span>
        </button>
      )}
    </>
  )
}
