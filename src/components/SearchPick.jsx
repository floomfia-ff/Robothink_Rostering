import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Close } from './coachIcons.jsx'

// A picker you can type into: typing narrows the list ("Ame" → Ameer), and the list always opens below the box,
// never over it. ↑ ↓ move, Enter picks, Esc closes.
//
// options: [{ value, label, hint?, group? }]. `hint` is a small grey tag on the right (Intern, THU…);
// `group` puts options under a heading (Centres / Preschools), in the order they first appear.
export default function SearchPick({ options, value, onChange, placeholder, label }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const listId = useId()
  const picked = options.find((o) => String(o.value) === String(value))

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(q)) : options

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return
    const away = (e) => !box.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const choose = (o) => {
    onChange(String(o.value))
    setQuery('')
    setOpen(false)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); choose(shown[active]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  let lastGroup
  return (
    <div ref={box} className="relative">
      <div className={`flex items-center rounded-lg border bg-white transition-colors ${open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          value={open ? query : picked?.label ?? ''}
          placeholder={picked ? picked.label : placeholder}
          onFocus={() => { setOpen(true); setActive(0) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={onKey}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        {picked && !open ? (
          <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange('')} className="mr-1 grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Close className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className={`mr-2.5 h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {open && (
        <ul id={listId} role="listbox" className="rt-pop absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No match for “{query}”</li>}
          {shown.map((o, i) => {
            const heading = o.group && o.group !== lastGroup ? o.group : null
            lastGroup = o.group
            return [
              heading && (
                <li key={`g-${heading}`} role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {heading}
                </li>
              ),
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={String(o.value) === String(value)}
                onMouseDown={(e) => { e.preventDefault(); choose(o) }}
                onMouseEnter={() => setActive(i)}
                className={`mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm ${i === active ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700'} ${String(o.value) === String(value) ? 'font-semibold' : ''}`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{o.hint}</span>}
              </li>,
            ]
          })}
        </ul>
      )}
    </div>
  )
}
