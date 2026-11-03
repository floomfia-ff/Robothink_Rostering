import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import CoachProfileModal from './CoachProfileModal.jsx'
import { Briefcase, GradCap, Info, Pencil, Person } from './coachIcons.jsx'

// Interns first, then part-timers. `title` is the section heading.
const GROUPS = [
  { type: 'intern', title: 'Interns', Icon: GradCap, empty: 'No interns. Change a coach to Intern with its dropdown.' },
  { type: 'part-timer', title: 'Part-Timers', Icon: Briefcase, empty: 'No part-timers. Change a coach to Part-timer with its dropdown.' },
]

// Nearest MRT and intern / part-timer per coach, saved by the page into the shared coaches table.
// Coaches are added, renamed and removed in the feedback site.
export default function CoachProfiles() {
  const { coaches, updateCoach } = useRoster()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // coach id whose window is open
  const missing = coaches.filter((c) => !c.mrt_station?.trim()).length
  const shown = coaches.filter((c) => `${c.name} ${c.mrt_station ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const editingCoach = coaches.find((c) => c.id === editing)

  return (
    <section aria-labelledby="profiles-title" className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="profiles-title" className="text-xl font-bold text-slate-900">Coach Profiles</h1>
        <SaveStatus />
      </div>

      <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <span>
          Each coach's nearest MRT station, so the roster can suggest the closest venue later. Click a coach to edit.
          {missing > 0 && <span className="font-semibold text-orange-600"> {missing} coach{missing === 1 ? '' : 'es'} still need a nearest MRT.</span>}
        </span>
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search coaches…"
        aria-label="Search coaches"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />

      {GROUPS.map(({ type, title, Icon, empty }) => {
        const members = shown.filter((c) => c.employment_type === type).sort((a, b) => a.name.localeCompare(b.name))
        return (
          <section key={type} aria-labelledby={`group-${type}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                <Icon />
              </span>
              <h2 id={`group-${type}`} className="flex-1 text-lg font-bold text-slate-900">{title}</h2>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {members.length} coach{members.length === 1 ? '' : 'es'}
              </span>
            </div>

            {members.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{search ? 'No matches.' : empty}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {members.map((c) => {
                  const selected = editing === c.id
                  const station = c.mrt_station?.trim()
                  return (
                    <li key={c.id} className={`group relative rounded-2xl border bg-white transition-shadow ${selected ? 'border-indigo-400 shadow-md ring-2 ring-indigo-100' : 'border-slate-200 hover:shadow-sm'}`}>
                      <button
                        type="button"
                        onClick={() => setEditing(c.id)}
                        aria-label={`Edit ${c.name}`}
                        className="flex w-full flex-col items-center gap-1 rounded-t-2xl px-3 pb-2 pt-5 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
                      >
                        <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-indigo-500">
                          <Person />
                        </span>
                        <span className="w-full truncate font-semibold text-slate-900" title={c.name}>{c.name}</span>
                        {station ? (
                          <span className="w-full truncate text-xs text-slate-500" title={station}>{station}</span>
                        ) : (
                          <span className="text-xs font-medium text-orange-600">Add nearest MRT</span>
                        )}
                        <span
                          aria-hidden="true"
                          className={`absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-indigo-50 text-indigo-600 transition-opacity motion-reduce:transition-none ${selected ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      <div className="px-3 pb-3">
                        <select
                          value={c.employment_type}
                          onChange={(e) => updateCoach(c.id, { employment_type: e.target.value })}
                          aria-label={`Employment type for ${c.name}`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                        >
                          <option value="intern">Intern</option>
                          <option value="part-timer">Part-timer</option>
                        </select>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      {editingCoach && <CoachProfileModal key={editingCoach.id} coach={editingCoach} onClose={() => setEditing(null)} />}
    </section>
  )
}
