import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import Dialog, { FIELD } from './Dialog.jsx'
import { Info, MapPin, Pencil, School } from './coachIcons.jsx'
import { isValidAddress } from '../lib/roster.js'

// Preschools first, then the weekend bases. Same card layout as Coach Profiles.
const GROUPS = [
  { kind: 'school', title: 'Preschools', Icon: School },
  { kind: 'base', title: 'Weekend bases', Icon: MapPin },
]

// Where each preschool and weekend base is. Schools are added and removed in the feedback site;
// address edits here save themselves into the shared tables.
export default function VenueProfiles() {
  const { venues } = useRoster()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // `${kind}-${id}` of the open card
  const missing = venues.filter((v) => !isValidAddress(v.address)).length
  const shown = venues.filter((v) => `${v.name} ${v.address}`.toLowerCase().includes(search.trim().toLowerCase()))
  const editingVenue = venues.find((v) => `${v.kind}-${v.id}` === editing)

  return (
    <section aria-labelledby="venues-title" className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="venues-title" className="text-xl font-bold text-slate-900">Venues</h1>
        <SaveStatus />
      </div>

      <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <span>
          Where each preschool and weekend base is, so the roster can work out travel later. Click a venue to edit its address.
          {missing > 0 && <span className="font-semibold text-orange-600"> {missing} venue{missing === 1 ? '' : 's'} still need an address ending in a 6-digit postal code.</span>}
        </span>
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search venues…"
        aria-label="Search venues"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />

      {GROUPS.map(({ kind, title, Icon }) => {
        const members = shown.filter((v) => v.kind === kind)
        return (
          <section key={kind} aria-labelledby={`group-${kind}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                <Icon className="h-5 w-5" />
              </span>
              <h2 id={`group-${kind}`} className="flex-1 text-lg font-bold text-slate-900">{title}</h2>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {members.length} venue{members.length === 1 ? '' : 's'}
              </span>
            </div>

            {members.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">No matches.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {members.map((v) => {
                  const key = `${v.kind}-${v.id}`
                  const selected = editing === key
                  const ok = isValidAddress(v.address)
                  return (
                    <li key={key} className={`group relative rounded-2xl border bg-white transition-shadow ${selected ? 'border-indigo-400 shadow-md ring-2 ring-indigo-100' : 'border-slate-200 hover:shadow-sm'}`}>
                      <button
                        type="button"
                        onClick={() => setEditing(key)}
                        aria-label={`Edit ${v.name}`}
                        className="flex h-full w-full flex-col items-center gap-1 rounded-2xl px-3 pb-4 pt-5 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
                      >
                        <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-indigo-500">
                          <Icon />
                        </span>
                        <span className="w-full truncate font-semibold text-slate-900" title={v.name}>{v.name}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{v.kind === 'base' ? 'Weekends' : v.days.join(', ')}</span>
                        {v.address ? (
                          <span className={`line-clamp-2 w-full text-xs ${ok ? 'text-slate-500' : 'text-red-600'}`} title={v.address}>{v.address}</span>
                        ) : (
                          <span className="text-xs font-medium text-orange-600">Add address</span>
                        )}
                        <span
                          aria-hidden="true"
                          className={`absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-indigo-50 text-indigo-600 transition-opacity motion-reduce:transition-none ${selected ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      {editingVenue && <VenueModal key={editing} venue={editingVenue} onClose={() => setEditing(null)} />}
    </section>
  )
}

function VenueModal({ venue, onClose }) {
  const { updateVenue } = useRoster()
  const [address, setAddress] = useState(venue.address ?? '')
  const bad = !!address.trim() && !isValidAddress(address)

  const save = () => {
    if (bad) return // the field says what's wrong
    if (address.trim() !== (venue.address ?? '').trim()) updateVenue(venue.kind, venue.id, { address: address.trim() })
    onClose()
  }

  return (
    <Dialog title={venue.name} onSave={save} onClose={onClose}>
      <div>
        <label htmlFor="venue-address" className="mb-1 block text-sm font-medium text-slate-700">Address</label>
        <input
          id="venue-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 1 Fusionopolis Walk, Singapore 138628"
          autoComplete="off"
          aria-invalid={bad}
          aria-describedby="venue-address-problem"
          className={`${FIELD} ${bad ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
        />
        {bad && <p id="venue-address-problem" className="mt-1 text-xs text-red-600">Must end in a 6-digit postal code.</p>}
      </div>
      <p className="text-xs text-slate-500">To add or remove a preschool, use the Schools tab on the feedback site.</p>
    </Dialog>
  )
}
