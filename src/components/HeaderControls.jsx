import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { useRoster } from '../context/RosterContext.jsx'
import { downloadXlsx, sheetCells, sheetFor } from '../lib/export.js'
import SaveStatus from './SaveStatus.jsx'
import { coachDay, isValidSlotTime, leadWarnings, mondayOf, quotaWarnings } from '../lib/roster.js'
import { addDays, weekShell } from '../../supabase/functions/roster/logic.js'
import { Alert, ArrowLeft, ArrowRight, Calendar, CalendarClock, CheckCircle, ChevronDown, Download, Eraser, Plus, Search, Sparkle, Trash, Undo } from './coachIcons.jsx'

// Shared look for the header's pill controls
const PILL = 'inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700'
const SELECT = `${PILL} appearance-none pl-10 pr-9 cursor-pointer`

// A pill select with an icon on the left and a chevron on the right.
function PillSelect({ icon, className = '', ...props }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-indigo-500">{icon}</span>
      <select {...props} className={SELECT} />
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </span>
  )
}

// A button that opens a small panel below it; closes on a click outside or Escape.
// `children` may be a function that gets `close`, for panels that close themselves when done.
function PopMenu({ trigger, className, align = 'right-0', width = 'w-48', children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const outside = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const escape = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div ref={ref} className="relative print:hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={className}>
        {trigger} <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute ${align} z-20 mt-2 flex ${width} flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg`}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

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

// Pick any day; the week it falls in is added (or opened, if it's already there). Starts on the week after the last one.
function NewWeekPanel({ weeks, createWeek, busy, close }) {
  const [day, setDay] = useState(() => addDays(weeks.at(-1).id, 7))
  const id = day ? mondayOf(day) : null
  const exists = weeks.some((w) => w.id === id)
  return (
    <div className="space-y-2 p-2">
      <label className="block text-xs font-semibold text-slate-600">
        Any day in the week
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none" />
      </label>
      <p className="text-xs text-slate-500">{id ? `Week of ${weekShell(id).label}${exists ? ' (already added)' : ''}` : 'Pick a date.'}</p>
      <ActionButton
        action={async () => (await createWeek(id)) && close()}
        label={exists ? 'Open week' : 'Add week'}
        working="Adding…"
        done="Added"
        failed="Couldn't add"
        disabled={!id || !!busy}
        size="w-full rounded-xl px-3 py-2 text-sm"
        className="bg-indigo-600 text-white hover:bg-indigo-700"
      />
    </div>
  )
}

// A button that shows its own result: `working` while the action runs, then green "✓ done" or red "failed"
// for a moment. The action resolves false for a failure and null when the admin cancelled (no message).
const BTN = 'font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-50'
export function ActionButton({ action, label, working, done, failed = 'Failed', className, disabled, size = 'rounded-lg px-3 py-1.5 text-sm' }) {
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
    <button type="button" onClick={click} disabled={disabled || state === 'working'} aria-live="polite" className={`${BTN} ${size} ${tone ?? className}`}>
      {{ idle: label, working, done: `✓ ${done}`, failed }[state]}
    </button>
  )
}

export default function HeaderControls() {
  const { week, weeks, weekId, setWeekId, coaches, coachById, busy, changes, clearChanges, autoGenerate, clearCoaches, createWeek, deleteWeek, restoreWeek, deletedWeeks, saving, planError, unmatchedSchools, highlight, setHighlight } =
    useRoster()

  const [showWarnings, setShowWarnings] = useState(false)
  const everyone = Object.values(coachById)
  // ClipboardItem takes the promise so the copy still counts as part of the click
  const copyPicture = () => navigator.clipboard.write([new ClipboardItem({ 'image/png': rosterPicture(week, coaches, everyone) })])
  const onClear = () =>
    window.confirm(`Remove every coach from every school and programme in ${week.label}? Availability stays.`)
      ? clearCoaches()
      : null
  const onDelete = () =>
    window.confirm(`Delete the whole week ${week.label}? You can bring it back from "Restore a deleted week".`) ? deleteWeek() : null

  const quota = [...quotaWarnings(week, coaches), ...leadWarnings(week, Object.values(coachById))]
  const badTimes = week.days.flatMap((d) =>
    d.blocks.filter((b) => b.kind === 'lesson' && b.slots.some((s) => !isValidSlotTime(s.time))).map((b) => `${d.label} ${d.date}: ${b.name} has a time in an unexpected format on the lesson plan sheet.`),
  )
  const alerts = [...badTimes, ...quota]

  const at = weeks.findIndex((w) => w.id === weekId)

  return (
    <header className="space-y-3">
      {planError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800 print:hidden">Lesson plan unavailable: {planError}</p>
      )}
      {unmatchedSchools.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900 print:hidden">Not found on the lesson plan: {unmatchedSchools.join(', ')}</p>
      )}
      <div className="relative rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 print:border-0 print:p-0 print:shadow-none">
        {/* soft lavender wash in the top-right corner; clipped on its own so menus can open past the card */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-clip rounded-3xl print:hidden">
          <div className="absolute -right-32 -top-40 h-80 w-[40rem] max-w-full rounded-full bg-indigo-100/50 blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 print:hidden">
            <CalendarClock />
          </span>
          <div className="mr-auto min-w-0 sm:border-l sm:border-slate-200 sm:pl-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Weekly Roster</h1>
            <p className="text-sm text-slate-500">Manage and view your coach roster for the week</p>
          </div>
          <SaveStatus />
          <PopMenu trigger={<><Download /> Export</>} className={`${PILL} px-4`}>
            <ActionButton action={copyPicture} label="Copy Picture" working="Copying…" done="Copied" failed="Couldn't copy" size="rounded-xl px-3 py-2 text-left text-sm" className="text-slate-700 hover:bg-indigo-50 hover:text-indigo-700" />
            <ActionButton action={() => downloadXlsx(week, coaches, everyone)} label="Export to Excel" working="Exporting…" done="Exported" failed="Couldn't export" size="rounded-xl px-3 py-2 text-left text-sm" className="text-slate-700 hover:bg-indigo-50 hover:text-indigo-700" />
          </PopMenu>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setWeekId(weeks[at - 1].id)} disabled={at <= 0} aria-label="Previous week" className={`${PILL} w-10 justify-center print:hidden`}>
            <ArrowLeft />
          </button>
          <PillSelect icon={<Calendar />} value={weekId} onChange={(e) => setWeekId(e.target.value)} aria-label="Week">
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </PillSelect>
          <button type="button" onClick={() => setWeekId(weeks[at + 1].id)} disabled={at >= weeks.length - 1} aria-label="Next week" className={`${PILL} w-10 justify-center print:hidden`}>
            <ArrowRight />
          </button>

          <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5 shadow-sm print:hidden">
            <PopMenu
              trigger={<><Plus /> New Week</>}
              align="left-0"
              width="w-64"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              {(close) => <NewWeekPanel weeks={weeks} createWeek={createWeek} busy={busy} close={close} />}
            </PopMenu>
            {/* not while a save runs: that save could put the week straight back */}
            <span title={weeks.length === 1 ? "The only week can't be deleted." : 'Delete this week and its coaches.'}>
              <ActionButton action={onDelete} label={<span className="inline-flex items-center gap-1.5"><Trash /> Delete Week</span>} working="Deleting…" done="Deleted" failed="Couldn't delete" disabled={!!busy || weeks.length === 1 || saving === 'saving'} size="h-9 rounded-full px-4 text-sm" className="text-indigo-700 hover:bg-red-50 hover:text-red-700" />
            </span>
          </div>

          {deletedWeeks.length > 0 && (
            <PillSelect icon={<Undo />} value="" onChange={(e) => e.target.value && restoreWeek(e.target.value)} disabled={!!busy} aria-label="Restore a deleted week" className="print:hidden">
              <option value="">Restore a deleted week…</option>
              {deletedWeeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </PillSelect>
          )}

          <span className="ml-auto print:hidden">
            {alerts.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowWarnings((s) => !s)}
                aria-expanded={showWarnings}
                aria-controls="roster-warnings"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
              >
                <Alert className="h-4 w-4 text-amber-600" /> {alerts.length} warning{alerts.length === 1 ? '' : 's'}
                <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${showWarnings ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
                <CheckCircle className="h-5 w-5 text-emerald-600" /> No warnings
              </span>
            )}
          </span>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 print:hidden">
          <ActionButton action={autoGenerate} label={<span className="inline-flex items-center gap-1.5"><Sparkle /> Auto-Generate Draft</span>} working="Generating…" done="Generated" failed="Couldn't generate" disabled={!!busy} size="h-10 rounded-full px-4 text-sm" className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100" />
          <PillSelect icon={<Search />} value={highlight} onChange={(e) => setHighlight(e.target.value)} aria-label="Find coach">
            <option value="">Find coach</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Unnamed coach'}
              </option>
            ))}
          </PillSelect>
          <ActionButton action={onClear} label={<span className="inline-flex items-center gap-1.5"><Eraser /> Clear coaches</span>} working="Clearing…" done="Cleared" disabled={!!busy} size="h-10 rounded-full px-4 text-sm" className="border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-700" />
        </div>

        {highlight && coachById[highlight] && (
          <p className="relative mt-4 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
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
