import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import SearchBox from './SearchBox.jsx'
import Dialog, { FIELD } from './Dialog.jsx'
import { Info, MapPin, Pencil, Plus, School } from './coachIcons.jsx'
import { isValidAddress } from '../lib/roster.js'
import StationName from './StationName.jsx'

// Brands and lesson days as the feedback site's Schools tab offers them, so both sites write the same values.
const BRANDS = ['MBR', 'ASH', 'SPL']
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']]

// Preschools first, then the weekend bases. Same card layout as Coach Profiles.
const GROUPS = [
  { kind: 'school', title: 'Preschools', Icon: School, empty: 'No preschools yet. Add the first one above.' },
  { kind: 'base', title: 'Weekend bases', Icon: MapPin, empty: 'No weekend bases yet.' },
]

// Where each preschool and weekend base is. Schools are added and removed in the feedback site;
// address edits here save themselves into the shared tables.
export default function VenueProfiles() {
  const { venues } = useRoster()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // `${kind}-${id}` of the open card
  const [adding, setAdding] = useState(false)
  const missing = venues.filter((v) => !isValidAddress(v.address)).length
  const shown = venues.filter((v) => `${v.name} ${v.address}`.toLowerCase().includes(search.trim().toLowerCase()))
  const editingVenue = venues.find((v) => `${v.kind}-${v.id}` === editing)

  return (
    <section aria-labelledby="venues-title" className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="venues-title" className="text-xl font-bold text-slate-900">Venues</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add preschool
        </button>
        <SaveStatus />
      </div>

      {adding && <AddSchool onClose={() => setAdding(false)} />}

      <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <span>
          Where each preschool and weekend base is, so the roster can work out travel later. Click a venue to edit its address. Travel times run to a preschool's MRT/LRT station when one is set. A preschool added here appears on the feedback site too — the two share one list.
          {missing > 0 && <span className="font-semibold text-orange-600"> {missing} venue{missing === 1 ? '' : 's'} still need an address ending in a 6-digit postal code.</span>}
        </span>
      </p>

      <SearchBox value={search} onChange={setSearch} label="Search venues" />

      {GROUPS.map(({ kind, title, Icon, empty }) => {
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
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{search ? 'No matches.' : empty}</p>
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
                        {v.station && <StationName station={v.station} />}
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
  const [station, setStation] = useState(venue.station ?? '')
  const bad = !!address.trim() && !isValidAddress(address)

  const save = () => {
    if (bad) return // the field says what's wrong
    const patch = {}
    if (address.trim() !== (venue.address ?? '').trim()) patch.address = address.trim()
    if (venue.kind === 'school' && station.trim() !== (venue.station ?? '').trim()) patch.station = station.trim()
    if (Object.keys(patch).length) updateVenue(venue.kind, venue.id, patch)
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
      {venue.kind === 'school' && (
        <div>
          <label htmlFor="venue-station" className="mb-1 block text-sm font-medium text-slate-700">Nearest MRT / LRT station</label>
          <input
            id="venue-station"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            placeholder="e.g. Braddell, or Samudera LRT"
            autoComplete="off"
            className={`${FIELD} border-slate-200`}
          />
          <p className="mt-1 text-xs text-slate-500">Travel times run to this station. Leave blank to use the postal code.</p>
        </div>
      )}
      <p className="text-xs text-slate-500">To add or remove a preschool, use the Schools tab on the feedback site.</p>
    </Dialog>
  )
}

// Adding a preschool, which used to mean opening the feedback site. The schools table is shared, so this
// writes the same row its Schools tab would - and that is why brand, class day and form code are here and
// not just the name. Its Google Form matching and its lesson-plan lookup read all three; a preschool created
// without them looks finished on this page and quietly does nothing over there.
// Weekend bases (WCP / DV) are fixed and are not created from either site.
function AddSchool({ onClose }) {
  const { createSchool, venues } = useRoster()
  const [form, setForm] = useState({ name: '', brand: 'MBR', class_day: '', form_code: '', address: '', station: '' })
  const [problem, setProblem] = useState('')
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setProblem('')
  }
  const taken = !!form.name.trim() && venues.some((v) => v.kind === 'school' && v.name.trim().toLowerCase() === form.name.trim().toLowerCase())
  const badAddress = !!form.address.trim() && !isValidAddress(form.address)

  // The server checks all of this again; this is just so a mistake is caught before a round trip.
  const save = async () => {
    if (!form.name.trim()) return setProblem('A preschool needs a name.')
    if (taken) return setProblem(`There is already a preschool called ${form.name.trim()}.`)
    if (badAddress) return setProblem('The address must end in a 6-digit postal code.')
    const sent = await createSchool({
      name: form.name.trim(),
      brand: form.brand,
      class_day: form.class_day || null,
      form_code: form.form_code.trim() || null,
      address: form.address.trim() || null,
      station: form.station.trim() || null,
    })
    if (sent) onClose()
    else setProblem("That didn't save. The message beside the page title says why.")
  }

  return (
    <Dialog title="Add a preschool" onSave={save} onClose={onClose}>
      {problem && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}
      <div>
        <label htmlFor="new-school-name" className="mb-1 block text-sm font-medium text-slate-700">Name</label>
        <input id="new-school-name" value={form.name} onChange={set('name')} placeholder="e.g. MBR Yishun" autoComplete="off" aria-invalid={taken} className={`${FIELD} ${taken ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
        {taken && <p className="mt-1 text-xs text-red-600">That name is already on the list.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-school-brand" className="mb-1 block text-sm font-medium text-slate-700">Brand</label>
          <select id="new-school-brand" value={form.brand} onChange={set('brand')} className={`${FIELD} border-slate-200`}>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-school-day" className="mb-1 block text-sm font-medium text-slate-700">Lesson day</label>
          <select id="new-school-day" value={form.class_day} onChange={set('class_day')} className={`${FIELD} border-slate-200`}>
            <option value="">Not set yet</option>
            {DAYS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="new-school-code" className="mb-1 block text-sm font-medium text-slate-700">Form code</label>
        <input id="new-school-code" value={form.form_code} onChange={set('form_code')} placeholder="e.g. RT-YIS" autoComplete="off" className={`${FIELD} border-slate-200`} />
        <p className="mt-1 text-xs text-slate-500">The feedback site matches Google Form replies to a preschool by this. Leave it blank only if there is no form yet.</p>
      </div>
      <div>
        <label htmlFor="new-school-address" className="mb-1 block text-sm font-medium text-slate-700">
          Address <span className="font-normal text-slate-400">— optional</span>
        </label>
        <input id="new-school-address" value={form.address} onChange={set('address')} placeholder="e.g. 1 Fusionopolis Walk, Singapore 138628" autoComplete="off" aria-invalid={badAddress} className={`${FIELD} ${badAddress ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
        {badAddress && <p className="mt-1 text-xs text-red-600">Must end in a 6-digit postal code.</p>}
      </div>
      <div>
        <label htmlFor="new-school-station" className="mb-1 block text-sm font-medium text-slate-700">
          Nearest MRT / LRT station <span className="font-normal text-slate-400">— optional</span>
        </label>
        <input id="new-school-station" value={form.station} onChange={set('station')} placeholder="e.g. Braddell, or Samudera LRT" autoComplete="off" className={`${FIELD} border-slate-200`} />
      </div>
    </Dialog>
  )
}
