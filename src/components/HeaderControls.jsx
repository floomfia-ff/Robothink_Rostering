import { useState } from 'react'
import { toBlob } from 'html-to-image'
import { useRoster } from '../context/RosterContext.jsx'
import { downloadXlsx, sheetCells, sheetFor } from '../lib/export.js'
import SaveStatus from './SaveStatus.jsx'
import { coachDay, isValidSlotTime, quotaWarnings } from '../lib/roster.js'

// The week as a PNG drawn from the same sheet as the Excel export, so the two always match.
async function rosterPicture(week, coaches, everyone) {
  const ws = await sheetFor(week, coaches, everyone)
  const widths = ws.columns.map((c) => Math.round((c.width ?? 9) * 7))
  const table = document.createElement('table')
  table.style.cssText = `width:${widths.reduce((a, b) => a + b)}px;border-collapse:collapse;table-layout:fixed;background:#fff;color:#000;font:13px Calibri,Arial,sans-serif`
  table.innerHTML = `<colgroup>${widths.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>`
  for (const row of sheetCells(ws)) {
    const tr = table.insertRow()
    for (const cell of row) {
      const td = tr.insertCell()
      td.colSpan = cell.span
      td.textContent = String(cell.value).replaceAll('/', '/​') // long "A/B/C" coach lists wrap after a slash
      Object.assign(td.style, {
        height: '20px', padding: '1px 4px', overflowWrap: 'anywhere',
        textAlign: cell.center ? 'center' : typeof cell.value === 'number' ? 'right' : 'left',
        background: cell.bg ?? '', fontWeight: cell.bold ? '700' : '400', color: cell.color ?? '',
        border: cell.border ? '1px solid #bfbfbf' : '',
      })
    }
  }
  const holder = document.createElement('div') // in the page but off-screen, so the browser lays it out
  holder.style.cssText = 'position:fixed;left:-99999px;top:0'
  holder.appendChild(table)
  document.body.appendChild(holder)
  try {
    return await toBlob(table, { pixelRatio: 2, backgroundColor: '#ffffff' })
  } finally {
    holder.remove()
  }
}

// A button that shows its own result: `working` while the action runs, then green "✓ done" or red "failed"
// for a moment. The action resolves false for a failure and null when the admin cancelled (no message).
const BTN = 'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-50'
function ActionButton({ action, label, working, done, failed = 'Failed', className, disabled }) {
  const [state, setState] = useState('idle')
  const click = async () => {
    setState('working')
    let result
    try {
      result = await action()
    } catch {
      result = false
    }
    if (result === null) return setState('idle')
    setState(result === false ? 'failed' : 'done')
    setTimeout(() => setState('idle'), 2500)
  }
  const tone = { done: 'bg-emerald-600 text-white ring-1 ring-emerald-600', failed: 'bg-red-600 text-white ring-1 ring-red-600' }[state]
  return (
    <button type="button" onClick={click} disabled={disabled || state === 'working'} aria-live="polite" className={`${BTN} ${tone ?? className}`}>
      {{ idle: label, working, done: `✓ ${done}`, failed }[state]}
    </button>
  )
}

export default function HeaderControls() {
  const { week, weeks, weekId, setWeekId, coaches, coachById, busy, changes, clearChanges, autoGenerate, clearCoaches, saveDraft, publish, createWeek, planError, unmatchedSchools, highlight, setHighlight } =
    useRoster()

  const [showWarnings, setShowWarnings] = useState(false)
  const everyone = Object.values(coachById)
  // ClipboardItem takes the promise so the copy still counts as part of the click
  const copyPicture = () => navigator.clipboard.write([new ClipboardItem({ 'image/png': rosterPicture(week, coaches, everyone) })])
  const downloadPicture = async () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(await rosterPicture(week, coaches, everyone))
    a.download = `Roster ${week.label}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const onClear = () =>
    window.confirm(`Remove every coach from every school and programme in ${week.label}? Availability stays, and Undo brings them back.`)
      ? clearCoaches()
      : null

  const quota = quotaWarnings(week, coaches)
  const badTimes = week.days.flatMap((d) =>
    d.blocks.filter((b) => b.kind === 'lesson' && b.slots.some((s) => !isValidSlotTime(s.time))).map((b) => `${d.label} ${d.date}: ${b.name} has a time in an unexpected format on the lesson plan sheet.`),
  )
  const alerts = [...badTimes, ...quota]

  const onPublish = () => {
    const msg = alerts.length
      ? `There are ${alerts.length} warning(s). Publish the ${week.label} roster anyway?`
      : `Publish the ${week.label} roster to all coaches?`
    return window.confirm(msg) ? publish() : null
  }

  const quiet = 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
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
            <span className="print:hidden" title="Add the week after the last one, with fresh counts from the lesson plan.">
              <ActionButton action={createWeek} label="+ New week" working="Creating…" done="Week added" failed="Couldn't add" disabled={!!busy} className="text-indigo-700 hover:bg-indigo-50" />
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${status[1]}`}>{status[0]}</span>
            {alerts.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowWarnings((s) => !s)}
                aria-expanded={showWarnings}
                aria-controls="roster-warnings"
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200 print:hidden"
              >
                ⚠ {alerts.length} warning{alerts.length === 1 ? '' : 's'} {showWarnings ? '▴' : '▾'}
              </button>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 print:hidden">✓ No warnings</span>
            )}
            <SaveStatus />
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <ActionButton action={saveDraft} label="Save Draft" working="Saving…" done="Saved" failed="Save failed" disabled={!!busy} className={quiet} />
            <ActionButton
              action={onPublish}
              label={week.changedSincePublish ? 'Republish Roster' : 'Publish Roster'}
              working="Publishing…"
              done="Published"
              failed="Publish failed"
              disabled={!!busy}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 print:hidden">
          <ActionButton action={autoGenerate} label="✨ Auto-Generate Draft" working="Generating…" done="Generated" failed="Couldn't generate" disabled={!!busy} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100" />
          <ActionButton action={onClear} label="Clear coaches" working="Clearing…" done="Cleared" disabled={!!busy} className={quiet} />
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ActionButton action={copyPicture} label="Copy picture" working="Copying…" done="Copied" failed="Couldn't copy" className={quiet} />
            <ActionButton action={downloadPicture} label="Download picture" working="Saving…" done="Downloaded" failed="Couldn't save" className={quiet} />
            <ActionButton action={() => downloadXlsx(week, coaches, everyone)} label="Export to Excel" working="Exporting…" done="Exported" failed="Couldn't export" className={quiet} />
            <ActionButton action={() => window.print()} label="Print / PDF" working="Opening…" done="Print opened" className={quiet} />
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

      {showWarnings && alerts.length > 0 && (
        <ul id="roster-warnings" className="list-disc space-y-0.5 rounded-xl border border-amber-200 bg-amber-50 py-2.5 pr-4 pl-9 text-sm text-amber-900 print:hidden">
          {alerts.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </header>
  )
}
