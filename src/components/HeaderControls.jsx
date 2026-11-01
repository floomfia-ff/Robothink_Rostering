import { useRoster } from '../context/RosterContext.jsx'
import { downloadXlsx } from '../lib/export.js'
import SaveStatus from './SaveStatus.jsx'
import { blockStatus, coachDay, isValidSlotTime, quotaWarnings } from '../lib/roster.js'

export default function HeaderControls() {
  const { week, weeks, weekId, setWeekId, coaches, coachById, busy, changes, clearChanges, autoGenerate, saveDraft, publish, createWeek, planError, unmatchedSchools, highlight, setHighlight } =
    useRoster()

  const quota = quotaWarnings(week, coaches)
  const short = week.days.flatMap((d) =>
    d.blocks.filter((b) => blockStatus(b)?.tone === 'red').map((b) => `${d.label} ${d.date}: ${b.name} is understaffed (${blockStatus(b).label.toLowerCase()}).`),
  )
  const badTimes = week.days.flatMap((d) =>
    d.blocks.filter((b) => b.kind === 'lesson' && b.slots.some((s) => !isValidSlotTime(s.time))).map((b) => `${d.label} ${d.date}: ${b.name} has a time slot that isn't HH:MM - HH:MM.`),
  )
  const alerts = [...short, ...badTimes, ...quota]

  const onPublish = () => {
    const msg = alerts.length
      ? `There are ${alerts.length} warning(s). Publish the ${week.label} roster anyway?`
      : `Publish the ${week.label} roster to all coaches?`
    if (window.confirm(msg)) publish()
  }

  const btn = 'rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-50'
  const quiet = `${btn} bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50`
  const status =
    week.status !== 'published'
      ? ['Draft', 'bg-slate-100 text-slate-600 ring-slate-200']
      : week.changedSincePublish
        ? ['Published · changes not published', 'bg-amber-50 text-amber-800 ring-amber-200']
        : ['Published', 'bg-emerald-50 text-emerald-700 ring-emerald-200']

  return (
    <header className="space-y-3">
      {planError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800 print:hidden">Lesson plan unavailable: {planError}</p>
      )}
      {unmatchedSchools.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900 print:hidden">Not found on the lesson plan: {unmatchedSchools.join(', ')}</p>
      )}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 print:border-0 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Weekly Roster</h1>
            <select
              value={weekId}
              onChange={(e) => setWeekId(e.target.value)}
              aria-label="Week"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-800 print:border-0 print:bg-white"
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createWeek}
              title={`Copy ${week.label} into a new week after the last one. Leads move to the next coach.`}
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 print:hidden"
            >
              + New week
            </button>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${status[1]}`}>{status[0]}</span>
            <SaveStatus />
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={saveDraft} disabled={!!busy} className={quiet}>
              {busy === 'Saving' ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" onClick={onPublish} disabled={!!busy} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
              {busy === 'Publishing' ? 'Publishing…' : week.changedSincePublish ? 'Republish Roster' : 'Publish Roster'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 print:hidden">
          <button type="button" onClick={autoGenerate} disabled={!!busy} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}>
            {busy === 'Generating' ? 'Generating…' : '✨ Auto-Generate Draft'}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Find coach
            <select
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              <option value="">Everyone</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Unnamed coach'}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadXlsx(week, coaches)} className={quiet}>
              Export to Excel
            </button>
            <button type="button" onClick={() => window.print()} className={quiet}>
              Print / PDF
            </button>
          </div>
        </div>

        {highlight && coachById[highlight] && (
          <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900 print:hidden">
            <b>{coachById[highlight].name}:</b>{' '}
            {week.days
              .map((d) => {
                const s = coachDay(week, d.key, coachById[highlight])
                return `${d.label} ${s.where ?? { off: 'OFF', unavailable: 'X', free: 'not placed' }[s.status]}`
              })
              .join(' · ')}
          </p>
        )}
      </div>

      {changes && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm text-slate-700 print:hidden">
          <span className="h-3 w-3 rounded-full ring-2 ring-emerald-400 ring-offset-1" aria-hidden="true" />
          <span>
            {changes.added.length + changes.newLeads.length + changes.removed.length === 0 ? (
              'Auto-Generate found nothing to change.'
            ) : (
              <>
                Auto-Generate added <b>{changes.added.length}</b> coach{changes.added.length === 1 ? '' : 'es'}
                {changes.newLeads.length > 0 && (
                  <>
                    {' '}and set <b>{changes.newLeads.length}</b> Lead{changes.newLeads.length === 1 ? '' : 's'}
                  </>
                )}
                {' '}(green ring)
                {changes.removed.length > 0 &&
                  `. Took off ${changes.removed.length} who were unavailable or double-booked: ${[
                    ...new Set(changes.removed.map((k) => coachById[k.split(':').at(-1)]?.name ?? '?')),
                  ].join(', ')}`}
                .
              </>
            )}
          </span>
          <button type="button" onClick={clearChanges} className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-800">
            Clear highlights
          </button>
        </div>
      )}

      {alerts.length > 0 ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <p className="font-semibold">
            ⚠ {alerts.length} warning{alerts.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 print:hidden">
          ✓ All venues staffed and every intern meets the 4 weekdays + 1 weekend quota.
        </div>
      )}
    </header>
  )
}
