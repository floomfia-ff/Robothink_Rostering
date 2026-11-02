import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import { isValidAddress } from '../lib/roster.js'

// Where each school and weekend base is. Schools are added and removed in the feedback site;
// address edits here save themselves into the shared tables.
export default function VenueProfiles() {
  const { venues, updateVenue } = useRoster()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // `${kind}-${id}` of the open row
  const missing = venues.filter((v) => !isValidAddress(v.address)).length
  const shown = venues.filter((v) => `${v.name} ${v.address}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <section aria-labelledby="venues-title" className="max-w-4xl space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="venues-title" className="text-xl font-bold text-slate-900">Venues</h1>
        <SaveStatus />
      </div>
      {missing > 0 && <p className="text-sm font-medium text-amber-700">{missing} venue{missing === 1 ? '' : 's'} still need an address ending in a 6-digit postal code.</p>}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search schools and bases…"
        aria-label="Search venues"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No venues found.</li>}
        {shown.map((v) => {
          const key = `${v.kind}-${v.id}`
          const open = editing === key
          const badAddress = !!v.address && !isValidAddress(v.address)
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${v.kind === 'base' ? 'bg-slate-200 text-slate-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {v.kind === 'base' ? v.name : v.name.replace(/^(MBR|SPL|ASH)\s+/, '').charAt(0).toUpperCase()}
              </span>
              <span className="w-56 text-sm font-semibold text-slate-900">
                {v.name}
                <span className="ml-2 text-[11px] font-medium text-slate-500">{v.kind === 'base' ? 'Weekend base' : v.days.join(', ')}</span>
              </span>
              {open ? (
                <span className="min-w-0 flex-1">
                  <input
                    value={v.address}
                    placeholder="Address ending in the postal code"
                    autoFocus
                    onChange={(e) => updateVenue(v.kind, v.id, { address: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                    aria-label={`Address for ${v.name}`}
                    aria-invalid={badAddress}
                    className={`w-full rounded-lg border px-2 py-1 text-sm focus:outline-none ${badAddress ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'}`}
                  />
                  {badAddress && <span className="mt-1 block text-xs text-red-600">Must end in a 6-digit postal code</span>}
                </span>
              ) : (
                <span className={`min-w-0 flex-1 truncate text-right text-sm ${v.address ? 'text-slate-500' : 'italic text-amber-700'}`} title={v.address}>
                  {v.address || 'No address yet'}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditing(open ? null : key)}
                className={`rounded-lg px-2.5 py-1 text-sm font-medium ${open ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {open ? '✓ Done' : '✎ Edit'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
