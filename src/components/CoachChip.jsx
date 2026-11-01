import { useRoster } from '../context/RosterContext.jsx'

const ROLE_BADGE = {
  lead: { mark: '*', title: 'Lead coach', cls: 'bg-amber-400 text-amber-950' },
  shadow: { mark: '#', title: 'Shadow', cls: 'bg-sky-500 text-white' },
}

// Interns: filled chip. Part-timers: outlined chip. Without onClick it renders read-only.
// When a coach is picked in "Find coach", their chips get a ring and everyone else fades.
export default function CoachChip({ coach, role = 'coach', onClick }) {
  const { highlight } = useRoster()
  const badge = ROLE_BADGE[role]
  const focus = !highlight ? '' : highlight === coach.id ? 'ring-2 ring-amber-400 ring-offset-1' : 'opacity-25'
  const base = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
    coach.type === 'intern' ? 'bg-slate-700 text-white' : 'border border-slate-400 bg-white text-slate-700'
  } ${role === 'shadow' ? 'italic' : ''} ${focus || (role === 'shadow' ? 'opacity-80' : '')}`
  const content = (
    <>
      {badge && (
        <span title={badge.title} className={`grid h-4 w-4 place-items-center rounded-full text-[11px] font-bold not-italic ${badge.cls}`}>
          {badge.mark}
        </span>
      )}
      {coach.name}
    </>
  )
  if (!onClick) return <span className={base}>{content}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${badge?.title ?? 'Coach'} — click to swap`}
      className={`${base} cursor-pointer hover:ring-2 hover:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none`}
    >
      {content}
    </button>
  )
}
