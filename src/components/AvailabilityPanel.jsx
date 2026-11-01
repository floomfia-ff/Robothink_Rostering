import { useRoster } from '../context/RosterContext.jsx'
import { coachDay, dayTotals } from '../lib/roster.js'
import { GRID_COLS } from './WeeklyGrid.jsx'

const NEXT = { available: 'off', off: 'unavailable', unavailable: 'available' }
const CELL = {
  assigned: { text: '1', cls: 'bg-emerald-50 text-emerald-800' },
  free: { text: '–', cls: 'bg-amber-50 text-amber-700' },
  off: { text: 'OFF', cls: 'bg-slate-500 text-white' },
  unavailable: { text: 'X', cls: 'bg-slate-900 text-slate-400' },
}

export default function AvailabilityPanel() {
  const { week, coaches } = useRoster()
  const totals = week.days.map((d) => dayTotals(week, d.key, coaches))

  return (
    <section aria-label="Coach availability" className="mt-4 grid min-w-[1380px] border-r border-b border-slate-200" style={GRID_COLS}>
      <div className="border-t border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">Total Coaches</div>
      {totals.map((t, i) => (
        <div
          key={i}
          className="flex items-baseline justify-end border-t border-l border-slate-200 bg-yellow-200 px-2 py-2"
        >
          <span className="text-lg font-bold text-slate-900">{t.assigned}</span>
        </div>
      ))}

      <div className="border-t border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">Coaches Available</div>
      {totals.map((t, i) => (
        <div key={i} className="border-t border-l border-slate-200 bg-white px-2 py-2 text-right text-sm font-bold text-slate-800">{t.available}</div>
      ))}

      <Group title="Interns" list={coaches.filter((c) => c.employment_type === 'intern')} />
      <Group title="Part-Timers" list={coaches.filter((c) => c.employment_type !== 'intern')} />

      <p className="col-span-8 border-t border-l border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-500">
        1 = assigned · – = available but not placed · OFF = requested off · X = unavailable. Click a cell to change availability.
      </p>
    </section>
  )
}

function Group({ title, list }) {
  const { week, setAvailability } = useRoster()
  return (
    <>
      <div className="col-span-8 border-t border-slate-200 bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-600">{title}</div>
      {list.map((coach) => (
        <div key={coach.id} className="contents">
          <div className="border-t border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800">{coach.name}</div>
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
                className={`flex items-center justify-between border-t border-l border-slate-200 px-2 py-1 text-xs font-semibold hover:brightness-95 ${cell.cls}`}
              >
                <span className="truncate font-normal">{s.where ?? ''}</span>
                <span>{cell.text}</span>
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}
