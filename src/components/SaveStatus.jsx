import { useRoster } from '../context/RosterContext.jsx'

// Save state next to each page title: changes save themselves, so this only reports how that went.
export default function SaveStatus() {
  const { busy, dirty, saving, notice, noticeError } = useRoster()
  const failed = saving && !['saving', 'saved'].includes(saving)
  if (failed || noticeError) return <span role="alert" className="text-xs font-medium text-red-600">{failed ? saving : notice}</span>
  if (busy) return <span className="text-xs text-slate-500" aria-live="polite">{busy}…</span>
  if (saving === 'saving' || dirty) return <span className="text-xs text-slate-500" aria-live="polite">Saving…</span>
  if (saving === 'saved') return <span className="text-xs font-medium text-emerald-700" aria-live="polite">✓ All changes saved</span>
  return notice ? <span className="text-xs text-slate-500">{notice}</span> : null
}
