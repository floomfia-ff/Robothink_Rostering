import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import { ActionButton } from './HeaderControls.jsx'
import { Close, Info, Plus, Rules, School } from './coachIcons.jsx'
import { WEEKDAYS } from '../lib/roster.js'

// Rules Auto-Generate always follows. Each change goes straight to the server (see RosterContext addRule etc.).
const NUMBERS = [
  ['students_per_coach', 'Students per coach', 'One coach for every this many students, rounded up.', 3],
  ['max_coaches', 'Max coaches per school', 'Auto-Generate never puts more than this at one preschool.', 4],
]
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const CENTRES = ['WCP', 'DV']
const dayList = (days) => DAYS.filter((d) => days?.includes(d)).map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')
const FIELD = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none'
const DAY_ORDER = Object.fromEntries(DAYS.map((d, i) => [d, i]))
// A soft colour per coach, picked from the name so it stays the same between visits.
const AVATARS = ['bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700']
const avatarFor = (name) => AVATARS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATARS.length]

export default function RulesTab() {
  const { rules, coaches, schools, coachById, addRule, updateRule, removeRule, busy } = useRoster()
  const weekdaySchools = schools.filter((s) => s.active && WEEKDAYS.includes(s.class_day?.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const schoolName = Object.fromEntries(schools.map((s) => [s.id, s.name]))
  const fixed = rules.filter((r) => r.kind === 'fixed_coach')
  const place = (r) => (r.base ? `${r.base} · ${dayList(r.days)}` : schoolName[r.school_id] ?? 'Unknown school')
  const schoolById = Object.fromEntries(schools.map((s) => [s.id, s]))
  // One card per coach, with every place they're fixed to: centres first, then preschools in lesson-day order.
  const byCoach = Object.values(fixed.reduce((acc, r) => {
    (acc[r.coach_id] ??= { coachId: r.coach_id, name: coachById[r.coach_id]?.name ?? 'Unknown coach', rules: [] }).rules.push(r)
    return acc
  }, {})).sort((a, b) => a.name.localeCompare(b.name))
  const order = (r) => (r.base ? -1 : DAY_ORDER[schoolById[r.school_id]?.class_day?.toLowerCase()] ?? 9)
  byCoach.forEach((c) => c.rules.sort((a, b) => order(a) - order(b) || place(a).localeCompare(place(b))))

  return (
    <section aria-labelledby="rules-title" className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="rules-title" className="text-xl font-bold text-slate-900">Rules</h1>
        <SaveStatus />
      </div>

      <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <span>Auto-Generate follows these (centre rules on weekends too). Coaches not needed stay at WCP. Placing coaches by hand can break a rule; the roster then shows a warning.</span>
      </p>

      <Card title="Numbers" Icon={Rules}>
        <div className="grid gap-3 sm:grid-cols-2">
          {NUMBERS.map(([kind, label, help, fallback]) => (
            // keyed by the saved value, so the box resets when a save is undone or the rule changes
            <NumberRule key={`${kind}:${rules.find((r) => r.kind === kind)?.value ?? fallback}`} rule={rules.find((r) => r.kind === kind)} kind={kind} label={label} help={help} fallback={fallback} addRule={addRule} updateRule={updateRule} busy={busy} />
          ))}
        </div>
      </Card>

      <Card title="Fixed coaches" Icon={School} count={fixed.length}>
        <p className="mb-3 text-sm text-slate-500">A fixed coach always goes to that preschool on its lesson day, when they're working. Fixed at a centre: on weekdays they stay at WCP (never sent to a preschool); on weekends they join that centre's programme. Click a place to switch it off for now.</p>
        {byCoach.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {byCoach.map((c) => (
              <CoachCard key={c.coachId} coach={c} schoolById={schoolById} coaches={coaches} schools={weekdaySchools} addRule={addRule} updateRule={updateRule} removeRule={removeRule} busy={busy} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No fixed coaches yet. Add the first one below.</p>
        )}
        <AddFixed coaches={coaches} schools={weekdaySchools} addRule={addRule} busy={busy} />
      </Card>
    </section>
  )
}

// One coach and every place they're fixed to. Each place is a chip: click it to switch the rule on or off.
function CoachCard({ coach, schoolById, coaches, schools, addRule, updateRule, removeRule, busy }) {
  const [adding, setAdding] = useState(false)
  const on = coach.rules.filter((r) => r.active).length
  return (
    <li className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-bold ${avatarFor(coach.name)}`} aria-hidden="true">
          {coach.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-slate-900">{coach.name}</h3>
          <p className="text-xs text-slate-500">
            {coach.rules.length} place{coach.rules.length === 1 ? '' : 's'}
            {on < coach.rules.length && <> · {coach.rules.length - on} switched off</>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add place
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {coach.rules.map((r) => (
          <PlaceChip key={r.id} rule={r} school={schoolById[r.school_id]} coachName={coach.name} updateRule={updateRule} removeRule={removeRule} busy={busy} />
        ))}
      </ul>
      {adding && (
        <AddFixed coaches={coaches} schools={schools} addRule={addRule} busy={busy} fixedCoachId={coach.coachId} onDone={() => setAdding(false)} />
      )}
    </li>
  )
}

function PlaceChip({ rule, school, coachName, updateRule, removeRule, busy }) {
  const centre = !!rule.base
  const name = centre ? rule.base : school?.name ?? 'Unknown school'
  const when = centre ? dayList(rule.days) : school?.class_day ? school.class_day[0].toUpperCase() + school.class_day.slice(1).toLowerCase() : ''
  const tone = !rule.active
    ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
    : centre ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-sky-200 bg-sky-50 text-sky-900'
  return (
    <li className={`group inline-flex items-center rounded-full border text-sm transition-colors ${tone}`}>
      <button
        type="button"
        aria-pressed={rule.active}
        title={rule.active ? 'On: click to switch off' : 'Off: click to switch on'}
        aria-label={`${coachName} at ${name}${when ? `, ${when}` : ''}: ${rule.active ? 'on' : 'off'}`}
        onClick={() => updateRule(rule.id, { active: !rule.active })}
        disabled={!!busy}
        className="inline-flex items-center gap-2 rounded-l-full py-1.5 pl-3 pr-1 disabled:cursor-wait"
      >
        <span className={`h-2 w-2 rounded-full ${rule.active ? (centre ? 'bg-violet-500' : 'bg-sky-500') : 'bg-slate-300'}`} aria-hidden="true" />
        <span className={`font-semibold ${rule.active ? '' : 'line-through'}`}>{name}</span>
        {when && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${rule.active ? 'bg-white/80' : 'bg-white'}`}>{when}</span>}
      </button>
      <button
        type="button"
        aria-label={`Remove ${coachName} at ${name}`}
        onClick={() => window.confirm(`Remove ${coachName} at ${name}?`) && removeRule(rule.id)}
        disabled={!!busy}
        className="mr-1 grid h-6 w-6 place-items-center rounded-full opacity-60 transition hover:bg-red-100 hover:text-red-600 hover:opacity-100"
      >
        <Close className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function Card({ title, Icon, count, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="flex-1 text-lg font-bold text-slate-900">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{count} rule{count === 1 ? '' : 's'}</span>}
      </div>
      {children}
    </section>
  )
}

// Sends when the box loses focus or Enter is pressed, and only if the number changed.
// A send that doesn't go through puts the saved number back in the box.
function NumberRule({ rule, kind, label, help, fallback, addRule, updateRule, busy }) {
  const saved = rule?.value ?? fallback
  const [text, setText] = useState(String(saved))
  const send = async () => {
    const value = Number(text)
    if (!Number.isInteger(value) || value < 1 || value > 20) return setText(String(saved))
    if (value === saved) return
    if (!(await (rule ? updateRule(rule.id, { value }) : addRule({ kind, value })))) setText(String(saved))
  }
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-4">
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      <span className="mb-2 block text-xs text-slate-500">{help}</span>
      <input
        type="number"
        min="1"
        max="20"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={send}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        disabled={!!busy}
        className={`${FIELD} w-24 disabled:opacity-50`}
      />
    </label>
  )
}

// fixedCoachId: adding from a coach's own card, so the coach picker is skipped.
function AddFixed({ coaches, schools, addRule, busy, fixedCoachId, onDone }) {
  const [pickedCoach, setCoachId] = useState('')
  const coachId = fixedCoachId ?? pickedCoach
  const [where, setWhere] = useState('') // a school id, or 'WCP' / 'DV'
  const [days, setDays] = useState([])
  const centre = CENTRES.includes(where)
  const add = async () => {
    const ok = await addRule(centre ? { kind: 'fixed_coach', coach_id: Number(coachId), base: where, days } : { kind: 'fixed_coach', coach_id: Number(coachId), school_id: Number(where) })
    if (ok) {
      setCoachId('')
      setWhere('')
      setDays([])
      onDone?.()
    }
    return ok
  }
  const toggle = (d) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
      {fixedCoachId == null && (
        <>
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)} aria-label="Coach" className={FIELD}>
            <option value="">Pick a coach…</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-slate-400">→</span>
        </>
      )}
      <select value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Preschool or centre" className={FIELD}>
        <option value="">Pick a preschool or centre…</option>
        <optgroup label="Centres (pick the days)">
          {CENTRES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </optgroup>
        <optgroup label="Preschools">
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.class_day})
            </option>
          ))}
        </optgroup>
      </select>
      {centre && (
        <span role="group" aria-label="Days" className="inline-flex flex-wrap gap-1">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days.includes(d)}
              onClick={() => toggle(d)}
              className={`h-9 rounded-lg px-2.5 text-xs font-semibold uppercase ring-1 transition-colors ${days.includes(d) ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-indigo-50'}`}
            >
              {d}
            </button>
          ))}
        </span>
      )}
      <ActionButton
        action={add}
        label={fixedCoachId == null ? 'Add fixed coach' : 'Add'}
        working="Adding…"
        done="Added"
        failed="Couldn't add"
        disabled={!coachId || !where || (centre && !days.length) || !!busy}
        className="bg-indigo-600 text-white hover:bg-indigo-700"
      />
    </div>
  )
}
