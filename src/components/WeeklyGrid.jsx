import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import { baseCoaches, blockNameTaken, isWeekend } from '../lib/roster.js'
import CoachChip, { useCoachDrop } from './CoachChip.jsx'
import VenueRow from './VenueRow.jsx'

export const GRID_COLS = { gridTemplateColumns: '120px repeat(7, minmax(180px, 1fr))' }

export default function WeeklyGrid() {
  const { week } = useRoster()
  const bands = Math.max(...week.days.map((d) => d.blocks.filter((b) => b.kind !== 'other').length))

  return (
    <section aria-label="Weekly roster" className="grid min-w-[1380px] border-r border-b border-slate-200" style={GRID_COLS}>
      <div className="bg-slate-800 px-2 py-2 text-xs leading-5 text-white">
        <div><b className="text-amber-300">*</b> Lead Coach</div>
        <div><b className="text-sky-300">#</b> Shadow</div>
      </div>
      {week.days.map((d) => (
        <div key={d.key} className="border-l border-slate-600 bg-slate-800 py-2 text-center text-white">
          <div className="text-sm font-bold tracking-wide">{d.label}</div>
          <div className="text-xs text-slate-300">{d.date}</div>
        </div>
      ))}

      <div className="bg-slate-50" />
      <div className="col-span-5 border-l border-slate-200 bg-slate-50 py-1 text-center text-xs font-semibold text-slate-600">
        Interns report to WCP at 10am / Part Timers report 30 mins before lesson starts
      </div>
      {['sat', 'sun'].map((k) => (
        <div key={k} className="border-l border-slate-200 bg-slate-50 py-1 text-center text-xs font-semibold text-slate-600">9am to 4pm</div>
      ))}

      {Array.from({ length: bands }, (_, i) => <VenueRow key={i} band={i} />)}

      <div className="border-t border-slate-200 bg-slate-50 print:hidden" />
      {week.days.map((d) => (
        <AddVenue key={d.key} day={d} />
      ))}

      <BaseRow title="WCP" base="WCP" />
      <BaseRow title="DV" base="DV" />
      <BaseRow title="OTHERS" />
    </section>
  )
}

// Add a venue (weekday) or programme (weekend) to one day. Suggests names already used on the roster.
function AddVenue({ day }) {
  const { weeks, venues, addBlock } = useRoster()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [base, setBase] = useState('WCP')
  const weekend = isWeekend(day.key)

  // Weekend suggestions are programme names; picking one also picks its base.
  const programBase = new Map(weeks.flatMap((w) => w.days.flatMap((d) => d.blocks.filter((b) => b.kind === 'program').map((b) => [b.name, b.base]))))
  const suggestions = weekend ? [...programBase.keys()] : venues.map((v) => v.name).filter((n) => n !== 'WCP' && n !== 'DV')
  const taken = !!name.trim() && blockNameTaken(day, name)
  const listId = `venue-suggest-${day.key}`

  const close = () => {
    setOpen(false)
    setName('')
  }
  const submit = (e) => {
    e.preventDefault()
    if (!name.trim() || taken) return
    addBlock(day.key, name, weekend ? base : undefined)
    close()
  }

  if (!open) {
    return (
      <div className="border-t border-l border-slate-200 bg-slate-50 px-2 py-1 print:hidden">
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-slate-400 hover:text-indigo-600">
          + Add {weekend ? 'programme' : 'venue'}
        </button>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-1 border-t border-l border-slate-200 bg-indigo-50 p-2 print:hidden">
      <input
        autoFocus
        list={listId}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (programBase.has(e.target.value)) setBase(programBase.get(e.target.value))
        }}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        placeholder={weekend ? 'Programme name' : 'Venue name'}
        aria-label={`New ${weekend ? 'programme' : 'venue'} on ${day.label}`}
        aria-invalid={taken}
        className={`w-full rounded border px-2 py-1 text-xs focus:outline-none ${taken ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'}`}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {taken && <p className="text-[11px] text-red-600">Already on {day.label}</p>}
      {weekend && (
        <select value={base} onChange={(e) => setBase(e.target.value)} aria-label="Base" className="w-full rounded border border-slate-200 bg-white px-1 py-1 text-xs">
          <option value="WCP">WCP base</option>
          <option value="DV">DV base</option>
        </select>
      )}
      <div className="flex gap-1">
        <button type="submit" disabled={!name.trim() || taken} className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">
          Add
        </button>
        <button type="button" onClick={close} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-white">
          Cancel
        </button>
      </div>
    </form>
  )
}

// WCP / DV are derived (weekday WCP = interns not at a venue; weekends = that base's programmes).
// OTHERS is an editable block of its own.
function BaseRow({ title, base }) {
  const { week } = useRoster()
  return (
    <>
      <div className="col-span-8 border-t border-slate-200 bg-slate-100 py-1 text-center text-xs font-bold uppercase tracking-wider text-slate-600">{title}</div>
      <div className="border-t border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700">Coaches</div>
      {week.days.map((day) => (
        <BaseCell key={day.key} day={day} base={base} />
      ))}
    </>
  )
}

// Drop targets: weekday WCP (sends the coach back to base) and OTHERS. Weekend WCP / DV come from the programmes.
function BaseCell({ day, base }) {
  const { week, coaches, coachById, openSwap } = useRoster()
  const other = !base && day.blocks.find((b) => b.kind === 'other')
  const list = base ? baseCoaches(week, day.key, base, coaches) : other ? other.coaches : []
  const weekdayWcp = base === 'WCP' && !isWeekend(day.key)
  const drop = useCoachDrop(day.key, other ? other.id : null)
  const target = drop.valid && (weekdayWcp || other)
  const hint = weekdayWcp ? 'Interns not at a venue — drop a coach here to send them back to WCP' : base ? 'From programmes above' : ''
  return (
    <div
      {...(target ? drop.props : {})}
      title={hint}
      className={`flex items-start justify-between gap-1 border-t border-l border-slate-200 px-2 py-1.5 ${target && drop.over ? 'bg-indigo-50' : 'bg-white'} ${
        target ? 'outline-2 -outline-offset-2 outline-dashed outline-indigo-300' : ''
      }`}
    >
      <div className="flex flex-wrap gap-1">
        {list.map((c, i) => (
          <CoachChip
            key={`${c.id}-${i}`}
            coach={coachById[c.id]}
            role={c.role}
            dayKey={day.key}
            blockId={other ? other.id : undefined}
            onClick={other ? () => openSwap(day.key, other.id, i) : undefined}
          />
        ))}
        {other && (
          <button
            type="button"
            onClick={() => openSwap(day.key, other.id)}
            aria-label={`Add coach to Others on ${day.label}`}
            className="rounded-full border border-dashed border-slate-400 px-2 text-xs print:hidden text-slate-500 hover:border-indigo-500 hover:text-indigo-600"
          >
            +
          </button>
        )}
      </div>
      <span className="text-sm font-bold text-slate-700">{list.filter((c) => c.role !== 'shadow').length}</span>
    </div>
  )
}
