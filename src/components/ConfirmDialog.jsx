import { useEffect, useRef } from 'react'
import { Trash } from './coachIcons.jsx'
import { trapTab } from '../lib/focusTrap.js'

const BTN = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

// "Are you sure?" in the site's own style, instead of the browser's grey pop-up. Escape, Cancel or the backdrop
// close it; focus starts on Cancel so Enter never removes anything by accident.
export default function ConfirmDialog({ title, children, confirmLabel = 'Remove', onConfirm, onClose }) {
  const cancel = useRef(null)
  const box = useRef(null)
  const opener = useRef(document.activeElement)
  useEffect(() => {
    cancel.current?.focus()
    const back = opener.current
    return () => back?.focus?.()
  }, [])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') return e.stopPropagation(), onClose()
          trapTab(e, box.current)
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <Trash className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-bold text-slate-900">{title}</h2>
            <div className="mt-1 text-sm text-slate-600">{children}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancel} type="button" onClick={onClose} className={`${BTN} text-slate-600 hover:bg-slate-100`}>Cancel</button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`${BTN} bg-red-600 text-white hover:bg-red-700`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
