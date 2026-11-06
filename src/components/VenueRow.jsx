import { useRoster } from '../context/RosterContext.jsx'
import { blockStatus, countedCoaches } from '../lib/roster.js'
import CoachChip, { useCoachDrop } from './CoachChip.jsx'

// Header colour per day column, like the spreadsheet.
export const DAY_TONE = {
  mon: 'bg-violet-200', tue: 'bg-green-200', wed: 'bg-pink-200', thu: 'bg-sky-200',
  fri: 'bg-orange-200', sat: 'bg-slate-300', sun: 'bg-slate-300',
}
const STATUS_TONE = {
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
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
  const { coachById, openSwap, removeBlock, setNoLesson } = useRoster()
  const status = blockStatus(block)
  const isLesson = block.kind === 'lesson'
  const drop = useCoachDrop(day.key, block.id)
  const target = !block.noLesson && drop.valid

  return (
    <div
      {...(target ? drop.props : {})}
      className={`flex flex-col border-t border-l border-slate-200 ${target && drop.over ? 'bg-indigo-50' : 'bg-white'} ${
        target ? 'outline-2 -outline-offset-2 outline-dashed outline-indigo-300' : ''
      }`}
    >
      <div className={`group/head relative flex items-center gap-1 px-2 py-1 text-sm font-semibold text-slate-800 ${DAY_TONE[day.key]}`}>
        <span className="flex-1 text-center leading-tight" title={block.name}>{block.name}{block.inactive && ' (inactive)'}</span>
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
          {!isLesson && (
          <button
            type="button"
            onClick={() => removeBlock(day.key, block.id)}
            aria-label={`Remove ${block.name} from ${day.label}`}
            title="Remove from this day"
            className="rounded bg-white/70 px-1 text-xs text-slate-500 hover:bg-white hover:text-red-600"
          >
            ×
          </button>
          )}
        </span>
      </div>

      {isLesson && (
        <ul className="divide-y divide-slate-100 px-2 text-xs">
          {block.slots.map((slot, i) => {
            return (
              <li key={i} className="py-1">
                <div className={`flex justify-between gap-1 ${block.noLesson ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  <span>{slot.time}</span>
                  <span>{slot.students}</span>
                </div>
                {slot.builds?.map((b) => (
                  <div key={b.build} className="text-[11px] text-slate-400">{b.build} ×{b.students}</div>
                ))}
              </li>
            )
          })}
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
          {countedCoaches(block)} coach{countedCoaches(block) === 1 ? '' : 'es'}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  )
}
