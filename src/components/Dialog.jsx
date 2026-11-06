import { useEffect, useRef } from 'react'
import { Close, Pencil } from './coachIcons.jsx'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])'
export const FIELD = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200'
const BTN = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

// The edit window both profile pages use: Escape or the backdrop closes it, Tab stays inside, focus returns to
// whatever opened it. `onSave` runs on Save (or Enter); the page saves to the database by itself.
export default function Dialog({ title, onSave, onClose, children }) {
  const dialogRef = useRef(null)
  const opener = useRef(document.activeElement)

  useEffect(() => {
    dialogRef.current.querySelector('input, select')?.focus()
    const back = opener.current
    return () => back?.focus?.()
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
    if (e.key !== 'Tab') return
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)]
    const first = items[0]
    const last = items.at(-1)
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600">
            <Pencil className="h-4 w-4" />
          </span>
          <h2 id="dialog-title" className="flex-1 text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-500">
            <Close className="h-5 w-5" />
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
        >
          <div className="space-y-4 px-5 py-5">{children}</div>
          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <button type="submit" className={`${BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>Save</button>
            <button type="button" onClick={onClose} className={`${BTN} text-slate-600 hover:bg-slate-100`}>Cancel</button>
          </footer>
        </form>
      </div>
    </div>
  )
}
