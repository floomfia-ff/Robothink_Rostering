import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'

// Nearest MRT per coach. Stored now so the auto-generator can later
// match coaches to the closest venue.
export default function CoachProfiles() {
  const { coaches, updateCoach, createCoach, deleteCoach, saveDraft, busy } = useRoster()
  const missing = coaches.filter((c) => !c.mrt?.trim()).length
  const stations = [...new Set(coaches.map((c) => c.mrt?.trim()).filter(Boolean))].sort()
  const field = 'w-full rounded border px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none'

  return (
    <section aria-labelledby="profiles-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="profiles-title" className="text-xl font-bold text-slate-900">Coach Profiles</h1>
          <SaveStatus />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={createCoach} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50">
            + Add coach
          </button>
          <button type="button" onClick={saveDraft} disabled={!!busy} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50">
            {busy === 'Saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
        Each coach's nearest MRT station, so the roster can suggest the closest venue later.
        {missing > 0 && <span className="font-medium text-amber-700"> {missing} coach{missing === 1 ? '' : 'es'} still need a nearest MRT.</span>}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Nearest MRT</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {coaches.map((c) => {
              return (
                <tr key={c.id} className="align-top">
                  <td className="w-44 px-3 py-2">
                    <input
                      value={c.name}
                      placeholder="Name"
                      autoFocus={!c.name}
                      onChange={(e) => updateCoach(c.id, { name: e.target.value })}
                      aria-label="Name"
                      aria-invalid={!c.name.trim()}
                      className={`${field} ${c.name.trim() ? 'border-slate-200' : 'border-red-400 bg-red-50'}`}
                    />
                  </td>
                  <td className="w-36 px-3 py-2">
                    <select
                      value={c.type}
                      onChange={(e) => updateCoach(c.id, { type: e.target.value })}
                      aria-label={`Type for ${c.name || 'new coach'}`}
                      className={`${field} border-slate-200 bg-white`}
                    >
                      <option value="intern">Intern</option>
                      <option value="part-timer">Part-timer</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={c.mrt ?? ''}
                      list="mrt-stations"
                      placeholder="e.g. Toa Payoh"
                      onChange={(e) => updateCoach(c.id, { mrt: e.target.value })}
                      aria-label={`Nearest MRT for ${c.name || 'new coach'}`}
                      className={`${field} border-slate-200`}
                    />
                  </td>
                  <td className="w-20 px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => window.confirm(`Remove ${c.name || 'this coach'}? They'll be taken off every roster.`) && deleteCoach(c.id)}
                      className="py-1.5 text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <datalist id="mrt-stations">
          {stations.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </section>
  )
}
