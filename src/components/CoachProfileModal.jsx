import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import Dialog, { FIELD } from './Dialog.jsx'

// Edit a coach's type and nearest MRT. Names, adding and removing coaches stay in the feedback site.
export default function CoachProfileModal({ coach, onClose }) {
  const { coaches, updateCoach } = useRoster()
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
      <p className="text-xs text-slate-500">To rename, add or remove a coach, use the Coaches tab on the feedback site.</p>
    </Dialog>
  )
}
