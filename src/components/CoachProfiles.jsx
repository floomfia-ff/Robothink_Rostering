import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'

// Nearest MRT per coach. Stored now so the auto-generator can later
// match coaches to the closest venue.
export default function CoachProfiles() {
  const { coaches, updateCoach } = useRoster()
  const missing = coaches.filter((c) => !c.mrt_station?.trim()).length
  const stations = [...new Set(coaches.map((c) => c.mrt_station?.trim()).filter(Boolean))].sort()
  const field = 'w-full rounded border px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none'

  return (
    <section aria-labelledby="profiles-title" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="profiles-title" className="text-xl font-bold text-slate-900">Coach Profiles</h1>
        <SaveStatus />
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
        Each coach's nearest MRT station, so the roster can suggest the closest venue later.
        {missing > 0 && <span className="font-medium text-amber-700"> {missing} coach{missing === 1 ? '' : 'es'} still need a nearest MRT.</span>}
      </p>

      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white sm:w-fit">
        <table className="text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Nearest MRT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {coaches.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="w-40 px-3 py-1.5">
                  <span className="font-medium text-slate-800">{c.name}</span>
                </td>
                <td className="w-36 px-3 py-1.5">
                  <select
                    value={c.employment_type}
                    onChange={(e) => updateCoach(c.id, { employment_type: e.target.value })}
                    aria-label={`Type for ${c.name}`}
                    className={`${field} border-slate-200 bg-white`}
                  >
                    <option value="intern">Intern</option>
                    <option value="part-timer">Part-timer</option>
                  </select>
                </td>
                <td className="w-60 px-3 py-1.5">
                  <input
                    value={c.mrt_station ?? ''}
                    list="mrt-stations"
                    placeholder="e.g. Toa Payoh"
                    onChange={(e) => updateCoach(c.id, { mrt_station: e.target.value })}
                    aria-label={`Nearest MRT for ${c.name}`}
                    className={`${field} border-slate-200`}
                  />
                </td>
              </tr>
            ))}
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
