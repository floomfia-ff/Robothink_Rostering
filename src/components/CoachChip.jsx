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
  const { highlight, changes, dragging, setDragging, swapCoaches, coachById } = useRoster()
  const badge = ROLE_BADGE[role]
  const changed = changes?.keys.has(`${blockId}:${coach.id}`)
  // While another coach from the same day is dragged, this chip is a drop target: dropping swaps the two.
  const canSwap = dayKey && dragging?.dayKey === dayKey && dragging.coachId !== coach.id
  const swapping = canSwap && dragging.swapWith === coach.id
  const lifted = dayKey && dragging?.dayKey === dayKey && dragging.coachId === coach.id
  const swapTarget = canSwap && {
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (!swapping) setDragging((d) => d && { ...d, swapWith: coach.id })
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDragging((d) => (d?.swapWith === coach.id ? { ...d, swapWith: null } : d)),
    onDrop: (e) => {
      e.preventDefault()
      e.stopPropagation() // the cell under it would otherwise add the coach as well
      swapCoaches(dayKey, dragging.coachId, coach.id)
      setDragging(null)
    },
  }
  const focus = swapping
    ? 'scale-110 ring-2 ring-amber-500 ring-offset-1'
    : lifted
      ? 'opacity-40'
      : highlight
    ? highlight === String(coach.id)
      ? 'ring-2 ring-amber-400 ring-offset-1'
      : 'opacity-25'
    : changed
      ? 'ring-2 ring-emerald-400 ring-offset-1'
      : role === 'shadow'
        ? 'opacity-80'
        : ''
  const base = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-transform motion-reduce:transition-none ${
    swapping ? 'bg-amber-300 text-amber-950' : coach.employment_type === 'intern' ? 'bg-slate-700 text-white' : 'border border-slate-400 bg-white text-slate-700'
  } ${role === 'shadow' ? 'italic' : ''} ${focus}`
  const drag = dayKey && {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData('text/plain', coach.name)
      e.dataTransfer.effectAllowed = 'move'
      setDragging({ dayKey, coachId: coach.id })
    },
    onDragEnd: () => setDragging(null),
    ...swapTarget,
  }
  const title = `${badge?.title ?? 'Coach'}${changed ? ' · added by Auto-Generate' : ''}${dayKey ? ' — drag to move' : ''}${onClick ? ', click to swap' : ''}`
  const content = (
    <>
      {swapping && <span aria-hidden="true">⇄</span>}
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
// `ghost`: a see-through chip of the dragged coach, shown where they would land (not when over a coach to swap).
export function useCoachDrop(dayKey, toBlockId) {
  const { week, dragging, setDragging, moveCoach, coachById } = useRoster()
  const [over, setOver] = useState(false)
  const valid = dragging?.dayKey === dayKey
  const placed = valid && week.days.find((d) => d.key === dayKey).blocks.find((b) => b.coaches.some((c) => c.id === dragging.coachId))
  const alreadyHere = toBlockId ? placed?.id === toBlockId : !placed // dropping here would change nothing
  const ghost = valid && over && !dragging.swapWith && !alreadyHere && (
    <span aria-hidden="true" className="inline-flex items-center rounded-full border-2 border-dashed border-indigo-400 bg-indigo-100/70 px-2 py-0.5 text-xs font-medium text-indigo-700 opacity-80">
      + {coachById[dragging.coachId]?.name}
    </span>
  )
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
  return { valid, over: valid && over, props, ghost }
}

// Scrolls the page while a coach is dragged near the top or bottom edge; faster the closer to the edge.
export function useDragAutoScroll(active) {
  useEffect(() => {
    if (!active) return
    const EDGE = 100
    let speed = 0
    const onOver = (e) => {
      const y = e.clientY
      speed = y < EDGE ? -Math.ceil((EDGE - y) / 5) : y > innerHeight - EDGE ? Math.ceil((y - innerHeight + EDGE) / 5) : 0
    }
    const timer = setInterval(() => speed && window.scrollBy(0, speed), 16) // ~60 steps a second
    document.addEventListener('dragover', onOver)
    return () => {
      document.removeEventListener('dragover', onOver)
      clearInterval(timer)
    }
  }, [active])
}
