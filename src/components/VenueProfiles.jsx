import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import { isValidAddress } from '../lib/roster.js'

// Where each venue is. With coach home postal codes, this lets the roster suggest the closest venue later.
export default function VenueProfiles() {
  const { venues, updateVenue, removeVenue, saveDraft, busy } = useRoster()
  const [newName, setNewName] = useState('')
  const taken = venues.some((v) => v.name.toLowerCase() === newName.trim().toLowerCase())
  const addVenue = (e) => {
    e.preventDefault()
    if (!newName.trim() || taken) return
    updateVenue(newName.trim(), {})
    setNewName('')
  }
  const missing = venues.filter((v) => !v.address || !isValidAddress(v.postalCode)).length
  const field = 'w-full rounded border px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none'

  return (
    <section aria-labelledby="venues-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="venues-title" className="text-xl font-bold text-slate-900">Venues</h1>
          <SaveStatus />
        </div>
        <button type="button" onClick={saveDraft} disabled={!!busy} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50">
          {busy === 'Saving' ? 'Saving…' : 'Save'}
        </button>
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
        Every venue on the roster is listed here automatically. WCP and DV are the weekend bases.
        {missing > 0 && <span className="font-medium text-amber-700"> {missing} venue{missing === 1 ? '' : 's'} still need an address and 6-digit postal code.</span>}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Venue</th>
              <th className="px-3 py-2 font-semibold">Days</th>
              <th className="px-3 py-2 font-semibold">Address</th>
              <th className="px-3 py-2 font-semibold">Postal code</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {venues.map((v) => {
              const badPostal = !!v.postalCode && !isValidAddress(v.postalCode)
              return (
                <tr key={v.name} className="align-top">
                  <td className="w-52 px-3 py-3 font-medium text-slate-800">{v.name}</td>
                  <td className="w-32 px-3 py-3 text-xs text-slate-500">{v.days.length ? v.days.join(', ') : <i>Not on a roster yet</i>}</td>
                  <td className="px-3 py-2">
                    <input
                      value={v.address}
                      placeholder="e.g. 1 Fusionopolis Way"
                      onChange={(e) => updateVenue(v.name, { address: e.target.value })}
                      aria-label={`Address for ${v.name}`}
                      className={`${field} border-slate-200`}
                    />
                  </td>
                  <td className="w-36 px-3 py-2">
                    <input
                      value={v.postalCode}
                      placeholder="138632"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) => updateVenue(v.name, { postalCode: e.target.value.replace(/\D/g, '') })}
                      aria-label={`Postal code for ${v.name}`}
                      aria-invalid={badPostal}
                      className={`${field} ${badPostal ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                    />
                    {badPostal && <p className="mt-1 text-xs text-red-600">Must be 6 digits</p>}
                  </td>
                  <td className="w-24 px-3 py-2 text-right">
                    {v.days.length === 0 ? (
                      <button type="button" onClick={() => removeVenue(v.name)} className="py-1.5 text-xs font-medium text-red-600 hover:underline">
                        Remove
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400" title="Remove it from each day on the roster first">On roster</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <form onSubmit={addVenue} className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New venue name, e.g. MBR Bishan"
            aria-label="New venue name"
            aria-invalid={taken}
            className={`w-72 rounded border px-2 py-1.5 text-sm focus:outline-none ${taken ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'}`}
          />
          <button type="submit" disabled={!newName.trim() || taken} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 disabled:opacity-40">
            + Add venue
          </button>
          {taken && <span className="text-xs text-red-600">That venue is already listed</span>}
          <span className="text-xs text-slate-500">Then add it to a day from the Weekly Roster.</span>
        </form>
      </div>
    </section>
  )
}
