import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import { ActionButton } from './HeaderControls.jsx'
import { Close, Info, Rules, School } from './coachIcons.jsx'
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

export default function RulesTab() {
  const { rules, coaches, schools, coachById, addRule, updateRule, removeRule, busy } = useRoster()
  const weekdaySchools = schools.filter((s) => s.active && WEEKDAYS.includes(s.class_day?.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const schoolName = Object.fromEntries(schools.map((s) => [s.id, s.name]))
  const fixed = rules.filter((r) => r.kind === 'fixed_coach')
  const place = (r) => (r.base ? `${r.base} · ${dayList(r.days)}` : schoolName[r.school_id] ?? 'Unknown school')

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
        <p className="mb-3 text-sm text-slate-500">A fixed coach always goes to that preschool on its lesson day, when they're working. Fixed at a centre: on weekdays they stay at WCP (never sent to a preschool); on weekends they join that centre's programme.</p>
        <ul className="space-y-2">
          {fixed.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-2.5 ${r.active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
              <span className="flex-1 text-sm font-semibold text-slate-800">
                {coachById[r.coach_id]?.name ?? 'Unknown coach'} <span className="text-slate-400">→</span> {place(r)}
              </span>
              <button
                type="button"
                aria-pressed={r.active}
                aria-label={`Rule on: ${coachById[r.coach_id]?.name} at ${place(r)}`}
                onClick={() => updateRule(r.id, { active: !r.active })}
                disabled={!!busy}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${r.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'}`}
              >
                {r.active ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                aria-label="Remove rule"
                onClick={() => window.confirm('Remove this rule?') && removeRule(r.id)}
                disabled={!!busy}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Close className="h-4 w-4" />
              </button>
            </li>
          ))}
          {!fixed.length && <li className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">No fixed coaches yet.</li>}
        </ul>
        <AddFixed coaches={coaches} schools={weekdaySchools} addRule={addRule} busy={busy} />
      </Card>
    </section>
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

function AddFixed({ coaches, schools, addRule, busy }) {
  const [coachId, setCoachId] = useState('')
  const [where, setWhere] = useState('') // a school id, or 'WCP' / 'DV'
  const [days, setDays] = useState([])
  const centre = CENTRES.includes(where)
  const add = async () => {
    const ok = await addRule(centre ? { kind: 'fixed_coach', coach_id: Number(coachId), base: where, days } : { kind: 'fixed_coach', coach_id: Number(coachId), school_id: Number(where) })
    if (ok) {
      setCoachId('')
      setWhere('')
      setDays([])
    }
    return ok
  }
  const toggle = (d) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
      <select value={coachId} onChange={(e) => setCoachId(e.target.value)} aria-label="Coach" className={FIELD}>
        <option value="">Pick a coach…</option>
        {coaches.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <span className="text-slate-400">→</span>
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
        label="Add fixed coach"
        working="Adding…"
        done="Added"
        failed="Couldn't add"
        disabled={!coachId || !where || (centre && !days.length) || !!busy}
        className="bg-indigo-600 text-white hover:bg-indigo-700"
      />
    </div>
  )
}
