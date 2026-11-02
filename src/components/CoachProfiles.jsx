import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'

// Nearest MRT and intern / part-timer per coach. Coaches are added and removed in the feedback site;
// edits here save themselves into the shared coaches table.
export default function CoachProfiles() {
  const { coaches, updateCoach } = useRoster()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // coach id whose row is open
  const missing = coaches.filter((c) => !c.mrt_station?.trim()).length
  const stations = [...new Set(coaches.map((c) => c.mrt_station?.trim()).filter(Boolean))].sort()
  const shown = coaches.filter((c) => `${c.name} ${c.mrt_station ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const field = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none'

  return (
    <section aria-labelledby="profiles-title" className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="profiles-title" className="text-xl font-bold text-slate-900">Coach Profiles</h1>
        <SaveStatus />
      </div>
      {missing > 0 && <p className="text-sm font-medium text-amber-700">{missing} coach{missing === 1 ? '' : 'es'} still need a nearest MRT.</p>}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search coaches…"
        aria-label="Search coaches"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No coaches found.</li>}
        {shown.map((c) => {
          const open = editing === c.id
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{c.name.charAt(0).toUpperCase()}</span>
              <span className="flex-1 text-sm font-semibold text-slate-900">
                {c.name}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.employment_type === 'intern' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {c.employment_type === 'intern' ? 'Intern' : 'Part-timer'}
                </span>
              </span>
              {open ? (
                <>
                  <select value={c.employment_type} onChange={(e) => updateCoach(c.id, { employment_type: e.target.value })} aria-label={`Type for ${c.name}`} className={field}>
                    <option value="intern">Intern</option>
                    <option value="part-timer">Part-timer</option>
                  </select>
                  <input
                    value={c.mrt_station ?? ''}
                    list="mrt-stations"
                    placeholder="Nearest MRT, e.g. Toa Payoh"
                    autoFocus
                    onChange={(e) => updateCoach(c.id, { mrt_station: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                    aria-label={`Nearest MRT for ${c.name}`}
                    className={`${field} w-52`}
                  />
                </>
              ) : (
                <span className="text-sm text-slate-500">{c.mrt_station || '—'}</span>
              )}
              <button
                type="button"
                onClick={() => setEditing(open ? null : c.id)}
                className={`rounded-lg px-2.5 py-1 text-sm font-medium ${open ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {open ? '✓ Done' : '✎ Edit'}
              </button>
            </li>
          )
        })}
      </ul>
      <datalist id="mrt-stations">
        {stations.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </section>
  )
}
