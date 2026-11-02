import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import { isValidAddress } from '../lib/roster.js'

// Where each venue is. With coach home postal codes, this lets the roster suggest the closest venue later.
export default function VenueProfiles() {
  const { venues, updateVenue } = useRoster()
  const missing = venues.filter((v) => !isValidAddress(v.address)).length
  const field = 'w-full rounded border px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none'

  return (
    <section aria-labelledby="venues-title" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="venues-title" className="text-xl font-bold text-slate-900">Venues</h1>
        <SaveStatus />
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
        Every venue on the roster is listed here automatically. WCP and DV are the weekend bases.
        {missing > 0 && <span className="font-medium text-amber-700"> {missing} venue{missing === 1 ? '' : 's'} still need an address ending in a 6-digit postal code.</span>}
      </p>

      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white sm:w-fit">
        <table className="text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Venue</th>
              <th className="px-3 py-2 font-semibold">Days</th>
              <th className="px-3 py-2 font-semibold">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {venues.map((v) => {
              const badAddress = !!v.address && !isValidAddress(v.address)
              return (
                <tr key={`${v.kind}-${v.id}`} className="align-top">
                  <td className="w-48 px-3 py-2 font-medium text-slate-800">{v.name}</td>
                  <td className="w-20 px-3 py-2 text-xs text-slate-500">{v.days.length ? v.days.join(', ') : <i>Not on a roster yet</i>}</td>
                  <td className="w-[32rem] px-3 py-1.5">
                    <input
                      value={v.address}
                      placeholder="e.g. 1 Fusionopolis Way"
                      onChange={(e) => updateVenue(v.kind, v.id, { address: e.target.value })}
                      aria-label={`Address for ${v.name}`}
                      aria-invalid={badAddress}
                      className={`${field} ${badAddress ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                    />
                    {badAddress && <p className="mt-1 text-xs text-red-600">Must end in a 6-digit postal code</p>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
