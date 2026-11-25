import { useState } from 'react'
import { ChevronDown, Undo } from './coachIcons.jsx'

// Everything taken off the roster, folded away until asked for. Removing marks a row inactive rather than
// deleting it, so this is how it comes back. Nothing is shown at all when there is nothing removed, so the
// page looks no different until the day you need it.
// Used by Coach Profiles and Venues; `noun` is 'coach' or 'preschool'.
export default function Removed({ list, noun, bringBack }) {
  const [open, setOpen] = useState(false)
  if (!list.length) return null
  const plural = noun === 'coach' ? 'coaches' : `${noun}s`

  return (
    <section aria-labelledby="removed-title" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-600">
          <Undo className="h-5 w-5" />
        </span>
        <span id="removed-title" className="flex-1 text-lg font-bold text-slate-900">
          Removed {plural}
        </span>
        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">{list.length}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <p className="mb-3 mt-3 text-sm text-slate-500">
            Off every list and ignored by Auto-Generate, but still named in weeks that were already saved. Bring one back and it behaves as it did before.
          </p>
          <ul className="flex flex-wrap gap-2">
            {list.map((item) => (
              <li key={item.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-sm">
                <span className="font-semibold text-slate-700">{item.name}</span>
                <button
                  type="button"
                  onClick={() => bringBack(item.id)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
