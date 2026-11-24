import { Search } from './coachIcons.jsx'

// The search field on Coach Profiles and Venues. It takes the radius, border, shadow and focus ring of the
// cards around it, so it reads as part of the page rather than a bare input laid on top of one. A label, not
// a div, so clicking the icon or the padding puts the cursor in the box.
export default function SearchBox({ value, onChange, label }) {
  return (
    <label className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
      <Search className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label}…`}
        aria-label={label}
        className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />
    </label>
  )
}
