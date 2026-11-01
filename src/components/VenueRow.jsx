import { useRoster } from '../context/RosterContext.jsx'
import { blockStatus, countedCoaches, isValidSlotTime, requiredCoaches } from '../lib/roster.js'
import CoachChip, { useCoachDrop } from './CoachChip.jsx'

// Header colour per day column, like the spreadsheet.
export const DAY_TONE = {
  mon: 'bg-violet-200', tue: 'bg-green-200', wed: 'bg-pink-200', thu: 'bg-sky-200',
  fri: 'bg-orange-200', sat: 'bg-slate-300', sun: 'bg-slate-300',
}
const STATUS_TONE = {
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  red: 'bg-red-100 text-red-700 ring-red-300',
  yellow: 'bg-amber-100 text-amber-800 ring-amber-300',
  grey: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export function StatusBadge({ status }) {
  if (!status) return null
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_TONE[status.tone]}`}>{status.label}</span>
}

// One horizontal band of the sheet: the n-th venue block of every day.
export default function VenueRow({ band }) {
  const { week } = useRoster()
  return (
    <>
      <div className="border-t border-slate-200 bg-slate-50" />
      {week.days.map((day) => {
        const block = day.blocks.filter((b) => b.kind !== 'other')[band]
        return block ? (
          <VenueCell key={day.key} day={day} block={block} />
        ) : (
          <div key={day.key} className="border-t border-l border-slate-200 bg-slate-100" />
        )
      })}
    </>
  )
}

function VenueCell({ day, block }) {
  const { coachById, openSwap, updateSlot, addSlot, removeSlot, removeBlock, setNoLesson } = useRoster()
  const status = blockStatus(block)
  const need = requiredCoaches(block)
  const isLesson = block.kind === 'lesson'
  const drop = useCoachDrop(day.key, block.id)
  const target = !block.noLesson && drop.valid

  return (
    <div
      {...(target ? drop.props : {})}
      className={`flex flex-col border-t border-l border-slate-200 ${target && drop.over ? 'bg-indigo-50' : 'bg-white'} ${
        target ? 'outline-2 -outline-offset-2 outline-dashed outline-indigo-300' : status?.tone === 'red' ? 'ring-2 ring-inset ring-red-300' : ''
      }`}
    >
      <div className={`group/head relative flex items-center gap-1 px-2 py-1 text-sm font-semibold text-slate-800 ${DAY_TONE[day.key]}`}>
        <span className="flex-1 text-center leading-tight" title={block.name}>{block.name}</span>
        <span className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover/head:opacity-100 focus-within:opacity-100 print:hidden">
          {isLesson && (
            <button
              type="button"
              onClick={() => setNoLesson(day.key, block.id, !block.noLesson)}
              title={block.noLesson ? 'Lesson is back on' : 'Mark No Lesson (frees the coaches)'}
              className="rounded bg-white/70 px-1 text-[10px] font-semibold text-slate-600 hover:bg-white hover:text-red-600"
            >
              {block.noLesson ? 'Lesson on' : 'No lesson'}
            </button>
          )}
          <button
            type="button"
            onClick={() => removeBlock(day.key, block.id)}
            aria-label={`Remove ${block.name} from ${day.label}`}
            title="Remove from this day"
            className="rounded bg-white/70 px-1 text-xs text-slate-500 hover:bg-white hover:text-red-600"
          >
            ×
          </button>
        </span>
      </div>

      {block.kind === 'program' && (
        <label className="flex items-center justify-between gap-1 px-2 py-1 text-xs text-slate-500">
          Students
          <input
            type="number"
            min="0"
            value={block.slots[0]?.students ?? ''}
            placeholder="–"
            onChange={(e) => updateSlot(day.key, block.id, 0, { students: Math.max(0, Number(e.target.value) || 0) })}
            aria-label={`Students for ${block.name} on ${day.label}`}
            className="w-12 rounded border border-slate-200 px-1 py-0.5 text-right text-slate-800 focus:border-indigo-400 focus:outline-none"
          />
        </label>
      )}

      {isLesson && (
        <ul className="divide-y divide-slate-100 px-2 text-xs">
          {block.slots.map((slot, i) => {
            const badTime = !isValidSlotTime(slot.time)
            return (
              <li key={i} className="group flex items-center justify-between gap-1 py-1">
                <input
                  value={slot.time}
                  placeholder="15:30 - 16:30"
                  onChange={(e) => updateSlot(day.key, block.id, i, { time: e.target.value })}
                  aria-label={`Time slot ${i + 1} for ${block.name}`}
                  aria-invalid={badTime}
                  title={badTime ? 'Use 24-hour HH:MM - HH:MM, start before end' : undefined}
                  className={`w-[6.5rem] rounded border px-1 py-0.5 focus:outline-none ${
                    badTime ? 'border-red-400 bg-red-50 text-red-700' : 'border-transparent hover:border-slate-200 focus:border-indigo-400'
                  } ${block.noLesson ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                />
                <input
                  type="number"
                  min="0"
                  value={slot.students}
                  onChange={(e) => updateSlot(day.key, block.id, i, { students: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label={`Students for ${block.name} ${slot.time}`}
                  className="w-12 rounded border border-slate-200 px-1 py-0.5 text-right text-slate-800 focus:border-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSlot(day.key, block.id, i)}
                  aria-label={`Remove time slot ${slot.time || i + 1}`}
                  title="Remove slot"
                  className="px-0.5 text-slate-300 opacity-0 print:hidden group-hover:opacity-100 hover:text-red-600 focus-visible:opacity-100"
                >
                  ×
                </button>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => addSlot(day.key, block.id)}
              className="py-0.5 text-[11px] text-slate-400 hover:text-indigo-600 print:hidden"
            >
              + time slot
            </button>
          </li>
        </ul>
      )}

      <div className="flex flex-1 flex-wrap content-start gap-1 px-2 py-1.5">
        {block.noLesson && <span className="text-xs font-semibold text-red-600">No Lesson</span>}
        {block.coaches.map((c, i) => (
          <CoachChip key={`${c.id}-${i}`} coach={coachById[c.id]} role={c.role} dayKey={day.key} blockId={block.id} onClick={() => openSwap(day.key, block.id, i)} />
        ))}
        {!block.noLesson && (
          <button
            type="button"
            onClick={() => openSwap(day.key, block.id)}
            title="Add coach"
            aria-label={`Add coach to ${block.name}`}
            className="rounded-full border border-dashed border-slate-400 px-2 text-xs print:hidden text-slate-500 hover:border-indigo-500 hover:text-indigo-600"
          >
            +
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1 text-[11px] text-slate-500">
        <span>
          {(isLesson && !block.noLesson) || need > 0 ? `${countedCoaches(block)} / ${need} coaches` : `${countedCoaches(block)} coach${countedCoaches(block) === 1 ? '' : 'es'}`}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  )
}
