import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import SearchBox from './SearchBox.jsx'
import { ActionButton } from './HeaderControls.jsx'
import CoachProfileModal from './CoachProfileModal.jsx'
import Dialog, { FIELD } from './Dialog.jsx'
import { Briefcase, GradCap, Info, MapPin, Pencil, Person, Plus } from './coachIcons.jsx'
import { coachLevel } from '../lib/roster.js'
import StationName from './StationName.jsx'

// Advanced keeps the old Lead Coach amber.
const LEVEL_STYLE = {
  beginner: 'border-slate-200 bg-white text-slate-500',
  intermediate: 'border-sky-300 bg-sky-50 text-sky-900',
  advanced: 'border-amber-300 bg-amber-50 text-amber-900',
}

// Interns first, then part-timers. `title` is the section heading.
const GROUPS = [
  { type: 'intern', title: 'Interns', Icon: GradCap, empty: 'No interns. Change a coach to Intern with its dropdown.' },
  { type: 'part-timer', title: 'Part-Timers', Icon: Briefcase, empty: 'No part-timers. Change a coach to Part-timer with its dropdown.' },
]

// Nearest MRT and intern / part-timer per coach, saved by the page into the shared coaches table.
// A coach can now be added here as well as on the feedback site - it is one table either way. Renaming and
// removing stay there.
export default function CoachProfiles() {
  const { coaches, updateCoach, refreshTravelTimes, unrecognisedStations } = useRoster()
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // coach id whose window is open
  const [adding, setAdding] = useState(false)
  const missing = coaches.filter((c) => !c.mrt_station?.trim()).length
  const shown = coaches.filter((c) => `${c.name} ${c.mrt_station ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const editingCoach = coaches.find((c) => c.id === editing)

  return (
    <section aria-labelledby="profiles-title" className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="profiles-title" className="text-xl font-bold text-slate-900">Coach Profiles</h1>
        <ActionButton
          action={() => refreshTravelTimes((done, total) => setProgress({ done, total }))}
          label={<span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Work out travel times</span>}
          working={`Working out travel times… ${progress.done} / ${progress.total || '…'}`}
          done={`${progress.total} travel times up to date`}
          failed="Couldn't work out travel times"
          size="h-10 rounded-full px-4 text-sm"
          className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100"
        />
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add coach
        </button>
        <SaveStatus />
      </div>

      {adding && <AddCoach onClose={() => setAdding(false)} />}

      <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <span>
          Each coach's nearest MRT station, so the roster can suggest the closest venue later. Click a coach to edit. A coach added here appears on the feedback site too — the two share one list.
          {missing > 0 && <span className="font-semibold text-orange-600"> {missing} coach{missing === 1 ? '' : 'es'} still need a nearest MRT.</span>}
        </span>
      </p>

      <SearchBox value={search} onChange={setSearch} label="Search coaches" />

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
                          <span className="w-full text-xs text-slate-500" title={station}>
                            <StationName station={station} className="max-w-full" />
                            {unrecognisedStations.includes(c.id) && <span className="block font-medium text-orange-600">MRT not recognised</span>}
                          </span>
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
                        {/* can_lead kept in step (Advanced = old Lead Coach) for anything still reading it */}
                        <select
                          value={coachLevel(c)}
                          onChange={(e) => updateCoach(c.id, { coach_level: e.target.value, can_lead: e.target.value === 'advanced' })}
                          aria-label={`Coach level for ${c.name}`}
                          className={`mt-2 w-full rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${LEVEL_STYLE[coachLevel(c)]}`}
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
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

// Adding a coach, which used to mean opening the feedback site. The coaches table is shared, so this writes
// the same row its Coaches tab would. Only the name is required; the rest is what the roster itself uses and
// every bit of it can be changed afterwards by clicking the card.
function AddCoach({ onClose }) {
  const { createCoach, coaches } = useRoster()
  const [name, setName] = useState('')
  const [type, setType] = useState('intern')
  const [level, setLevel] = useState('beginner')
  const [mrt, setMrt] = useState('')
  const [problem, setProblem] = useState('')
  const stations = [...new Set(coaches.map((c) => c.mrt_station?.trim()).filter(Boolean))].sort()
  const taken = !!name.trim() && coaches.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())

  // The server checks all of this again; this is just so a mistake is caught before a round trip.
  const save = async () => {
    if (!name.trim()) return setProblem('A coach needs a name.')
    if (taken) return setProblem(`There is already a coach called ${name.trim()}.`)
    // can_lead is kept in step with the level, as the cards do.
    const sent = await createCoach({ name: name.trim(), employment_type: type, coach_level: level, can_lead: level === 'advanced', mrt_station: mrt.trim() || null })
    if (sent) onClose()
    else setProblem("That didn't save. The message beside the page title says why.")
  }

  return (
    <Dialog title="Add a coach" onSave={save} onClose={onClose}>
      {problem && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}
      <div>
        <label htmlFor="new-coach-name" className="mb-1 block text-sm font-medium text-slate-700">Name</label>
        <input
          id="new-coach-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setProblem('')
          }}
          autoComplete="off"
          aria-invalid={taken}
          className={`${FIELD} ${taken ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
        />
        {taken && <p className="mt-1 text-xs text-red-600">That name is already on the list.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-coach-type" className="mb-1 block text-sm font-medium text-slate-700">Employment type</label>
          <select id="new-coach-type" value={type} onChange={(e) => setType(e.target.value)} className={`${FIELD} border-slate-200`}>
            <option value="intern">Intern</option>
            <option value="part-timer">Part-timer</option>
          </select>
        </div>
        <div>
          <label htmlFor="new-coach-level" className="mb-1 block text-sm font-medium text-slate-700">Coach level</label>
          <select id="new-coach-level" value={level} onChange={(e) => setLevel(e.target.value)} className={`${FIELD} border-slate-200`}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="new-coach-mrt" className="mb-1 block text-sm font-medium text-slate-700">
          Nearest MRT <span className="font-normal text-slate-400">— optional</span>
        </label>
        <input id="new-coach-mrt" value={mrt} onChange={(e) => setMrt(e.target.value)} list="new-coach-stations" placeholder="e.g. Toa Payoh" autoComplete="off" className={`${FIELD} border-slate-200`} />
        <datalist id="new-coach-stations">
          {stations.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </Dialog>
  )
}
