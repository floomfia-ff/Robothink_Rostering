import { useEffect, useRef, useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import { Close, Pencil } from './coachIcons.jsx'

const FIELD = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200'
const BTN = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])'

// Edit a coach's type and nearest MRT. Names, adding and removing coaches stay in the feedback site.
// Save profile applies the change; the page then saves it to the database by itself.
export default function CoachProfileModal({ coach, onClose }) {
  const { coaches, updateCoach } = useRoster()
  const [type, setType] = useState(coach.employment_type)
  const [mrt, setMrt] = useState(coach.mrt_station ?? '')
  const dialogRef = useRef(null)
  const firstRef = useRef(null)
  const opener = useRef(document.activeElement)
  const stations = [...new Set(coaches.map((c) => c.mrt_station?.trim()).filter(Boolean))].sort()

  useEffect(() => {
    firstRef.current?.focus()
    const back = opener.current
    return () => back?.focus?.() // hand focus back to the card that opened this window
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
    if (e.key !== 'Tab') return
    // keep Tab inside the window
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

  const save = () => {
    const station = mrt.trim() || null
    const patch = {}
    if (type !== coach.employment_type) patch.employment_type = type
    if (station !== (coach.mrt_station?.trim() || null)) patch.mrt_station = station
    if (Object.keys(patch).length) updateCoach(coach.id, patch)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600">
            <Pencil className="h-4 w-4" />
          </span>
          <h2 id="profile-title" className="flex-1 text-lg font-semibold text-slate-900">{coach.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-500">
            <Close className="h-5 w-5" />
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="space-y-4 px-5 py-5">
            <div>
              <label htmlFor="coach-type" className="mb-1 block text-sm font-medium text-slate-700">Employment type</label>
              <select id="coach-type" ref={firstRef} value={type} onChange={(e) => setType(e.target.value)} className={FIELD}>
                <option value="intern">Intern</option>
                <option value="part-timer">Part-timer</option>
              </select>
            </div>
            <div>
              <label htmlFor="coach-mrt" className="mb-1 block text-sm font-medium text-slate-700">Nearest MRT</label>
              <input id="coach-mrt" value={mrt} onChange={(e) => setMrt(e.target.value)} list="coach-mrt-stations" placeholder="e.g. Toa Payoh" autoComplete="off" className={FIELD} />
              <datalist id="coach-mrt-stations">
                {stations.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <p className="text-xs text-slate-500">To rename, add or remove a coach, use the Coaches tab on the feedback site.</p>
          </div>

          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <button type="submit" className={`${BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>Save profile</button>
            <button type="button" onClick={onClose} className={`${BTN} text-slate-600 hover:bg-slate-100`}>Cancel</button>
          </footer>
        </form>
      </div>
    </div>
  )
}
