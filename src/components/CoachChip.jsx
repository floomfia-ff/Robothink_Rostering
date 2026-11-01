import { useEffect, useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'

const ROLE_BADGE = {
  lead: { mark: '*', title: 'Lead coach', cls: 'bg-amber-400 text-amber-950' },
  shadow: { mark: '#', title: 'Shadow', cls: 'bg-sky-500 text-white' },
}

// Interns: filled chip. Part-timers: outlined chip. Without onClick it renders read-only.
// With dayKey it can be dragged to another venue on the same day.
// "Find coach" rings the picked coach and fades the rest; Auto-Generate rings what it added in green.
export default function CoachChip({ coach, role = 'coach', onClick, dayKey, blockId }) {
  const { highlight, changes, setDragging, coachById } = useRoster()
  const badge = ROLE_BADGE[role]
  const changed = changes?.keys.has(`${blockId}:${coach.id}`)
  const focus = highlight
    ? highlight === String(coach.id)
      ? 'ring-2 ring-amber-400 ring-offset-1'
      : 'opacity-25'
    : changed
      ? 'ring-2 ring-emerald-400 ring-offset-1'
      : role === 'shadow'
        ? 'opacity-80'
        : ''
  const base = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
    coach.employment_type === 'intern' ? 'bg-slate-700 text-white' : 'border border-slate-400 bg-white text-slate-700'
  } ${role === 'shadow' ? 'italic' : ''} ${focus}`
  const drag = dayKey && {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData('text/plain', coach.name)
      e.dataTransfer.effectAllowed = 'move'
      setDragging({ dayKey, coachId: coach.id })
    },
    onDragEnd: () => setDragging(null),
  }
  const title = `${badge?.title ?? 'Coach'}${changed ? ' · added by Auto-Generate' : ''}${dayKey ? ' — drag to move' : ''}${onClick ? ', click to swap' : ''}`
  const content = (
    <>
      {badge && (
        <span title={badge.title} className={`grid h-4 w-4 place-items-center rounded-full text-[11px] font-bold not-italic ${badge.cls}`}>
          {badge.mark}
        </span>
      )}
      {coach.name}
      {coachById[coach.id]?.active === false && ' (inactive)'}
    </>
  )
  if (!onClick) {
    return (
      <span {...drag} title={title} className={`${base} ${dayKey ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      {...drag}
      title={title}
      className={`${base} cursor-pointer hover:ring-2 hover:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none`}
    >
      {content}
    </button>
  )
}

// Makes a venue / WCP / OTHERS cell accept a dragged coach from the same day. toBlockId null = back to base.
export function useCoachDrop(dayKey, toBlockId) {
  const { dragging, setDragging, moveCoach } = useRoster()
  const [over, setOver] = useState(false)
  const valid = dragging?.dayKey === dayKey
  useEffect(() => {
    if (!dragging) setOver(false)
  }, [dragging])
  const props = valid
    ? {
        onDragOver: (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOver(true)
        },
        onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setOver(false),
        onDrop: (e) => {
          e.preventDefault()
          moveCoach(dayKey, dragging.coachId, toBlockId)
          setDragging(null) // the dragged chip may unmount, so dragend isn't guaranteed
        },
      }
    : {}
  return { valid, over: valid && over, props }
}
