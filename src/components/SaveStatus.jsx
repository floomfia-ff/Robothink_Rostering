import { useRoster } from '../context/RosterContext.jsx'

// Save state next to each page title: error (red) > in progress > unsaved > last notice.
export default function SaveStatus() {
  const { busy, dirty, notice, noticeError } = useRoster()
  if (noticeError) return <span role="alert" className="text-xs font-medium text-red-600">{notice}</span>
  if (busy) return <span className="text-xs text-slate-500" aria-live="polite">{busy}…</span>
  if (dirty) return <span className="text-xs font-medium text-amber-700">● Unsaved changes</span>
  return notice ? <span className="text-xs text-slate-500">{notice}</span> : null
}
