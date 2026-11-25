import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import { useConfirm } from './ConfirmProvider.jsx'
import Dialog, { FIELD } from './Dialog.jsx'
import { Trash } from './coachIcons.jsx'

// Edit a coach's type and nearest MRT, or take them off the roster. Renaming stays on the feedback site.
export default function CoachProfileModal({ coach, onClose }) {
  const { coaches, updateCoach } = useRoster()
  const confirm = useConfirm()
  const [type, setType] = useState(coach.employment_type)
  const [mrt, setMrt] = useState(coach.mrt_station ?? '')
  const stations = [...new Set(coaches.map((c) => c.mrt_station?.trim()).filter(Boolean))].sort()

  const save = () => {
    const station = mrt.trim() || null
    const patch = {}
    if (type !== coach.employment_type) patch.employment_type = type
    if (station !== (coach.mrt_station?.trim() || null)) patch.mrt_station = station
    if (Object.keys(patch).length) updateCoach(coach.id, patch)
    onClose()
  }

  // Removing marks the coach inactive rather than deleting the row. Deleting would cascade: their sign-in
  // (coach_logins) and any fixed-coach rule go with them, and weeks already saved would name a coach that no
  // longer exists. Inactive keeps all of that and takes them out of every list; "Show removed" brings them
  // back. The permanent delete lives on the feedback site.
  const remove = async () => {
    const yes = await confirm({
      title: `Remove ${coach.name} from the roster?`,
      body: 'They come off every list and Auto-Generate stops placing them. Weeks already saved keep their name. You can bring them back from "Show removed" on this page.',
      confirmLabel: 'Remove coach',
    })
    if (!yes) return
    updateCoach(coach.id, { active: false })
    onClose()
  }

  return (
    <Dialog title={coach.name} onSave={save} onClose={onClose}>
      <div>
        <label htmlFor="coach-type" className="mb-1 block text-sm font-medium text-slate-700">Employment type</label>
        <select id="coach-type" value={type} onChange={(e) => setType(e.target.value)} className={`${FIELD} border-slate-200`}>
          <option value="intern">Intern</option>
          <option value="part-timer">Part-timer</option>
        </select>
      </div>
      <div>
        <label htmlFor="coach-mrt" className="mb-1 block text-sm font-medium text-slate-700">Nearest MRT</label>
        <input id="coach-mrt" value={mrt} onChange={(e) => setMrt(e.target.value)} list="coach-mrt-stations" placeholder="e.g. Toa Payoh" autoComplete="off" className={`${FIELD} border-slate-200`} />
        <datalist id="coach-mrt-stations">
          {stations.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">To rename a coach, use the Coaches tab on the feedback site.</p>
        <button
          type="button"
          onClick={remove}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          <Trash className="h-4 w-4" /> Remove from roster
        </button>
      </div>
    </Dialog>
  )
}
