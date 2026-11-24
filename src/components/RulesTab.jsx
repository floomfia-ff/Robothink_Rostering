import { useState } from 'react'
import { useRoster } from '../context/RosterContext.jsx'
import SaveStatus from './SaveStatus.jsx'
import SearchPick from './SearchPick.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { ActionButton } from './HeaderControls.jsx'
import { Close, Info, Plus, Rules, School, Trash } from './coachIcons.jsx'
import { WEEKDAYS } from '../lib/roster.js'

// Rules Auto-Generate always follows. Each change goes straight to the server (see RosterContext addRule etc.).
// Each row reads as the sentence the number finishes, so the setting says what it does without a separate label.
// [kind, fallback, step, words before the box, words after it, the fine print]
const NUMBERS = [
  ['students_per_coach', 3, 0.5, 'One coach for every', 'students', 'Rounded up, so at 3.5 a class of 10 asks for 3 coaches. Halves are allowed.'],
  ['max_coaches', 4, 1, 'Never send more than', 'coaches to one preschool', 'A hard ceiling: Auto-Generate stops here even when the ratio asks for more.'],
]
const CLASS_SIZES = [6, 9, 12, 15, 18]
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const CENTRES = ['WCP', 'DV']
const dayList = (days) => DAYS.filter((d) => days?.includes(d)).map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')
const DAY_ORDER = Object.fromEntries(DAYS.map((d, i) => [d, i]))
// A soft colour per coach, picked from the name so it stays the same between visits.
const AVATARS = ['bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700']
const EMPLOYMENT = {
  intern: ['Intern', 'bg-amber-50 text-amber-700 ring-amber-200'],
  'part-timer': ['Part-timer', 'bg-teal-50 text-teal-700 ring-teal-200'],
}
const avatarFor = (name) => AVATARS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATARS.length]

export default function RulesTab() {
  const { rules, coaches, schools, coachById, addRule, updateRule, removeRule, removeRules, busy } = useRoster()
  const weekdaySchools = schools.filter((s) => s.active && WEEKDAYS.includes(s.class_day?.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const schoolName = Object.fromEntries(schools.map((s) => [s.id, s.name]))
  const fixed = rules.filter((r) => r.kind === 'fixed_coach')
  const place = (r) => (r.base ? `${r.base} · ${dayList(r.days)}` : schoolName[r.school_id] ?? 'Unknown school')
  const schoolById = Object.fromEntries(schools.map((s) => [s.id, s]))
  // One card per coach, with every place they're fixed to: centres first, then preschools in lesson-day order.
  const byCoach = Object.values(fixed.reduce((acc, r) => {
    (acc[r.coach_id] ??= { coachId: r.coach_id, name: coachById[r.coach_id]?.name ?? 'Unknown coach', type: coachById[r.coach_id]?.employment_type, rules: [] }).rules.push(r)
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
        <NumbersPanel rules={rules} addRule={addRule} updateRule={updateRule} busy={busy} />
      </Card>

      <Card title="Fixed coaches" Icon={School} count={fixed.length}>
        <p className="mb-3 text-sm text-slate-500">A fixed coach always goes to that preschool on its lesson day, when they're working. Fixed at a centre: on weekdays they stay at WCP (never sent to a preschool); on weekends they join that centre's programme. Click a place to switch it off for now.</p>
        <AddFixed coaches={coaches} schools={weekdaySchools} addRule={addRule} busy={busy} />
        {byCoach.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {byCoach.map((c) => (
              <CoachCard key={c.coachId} coach={c} schoolById={schoolById} coaches={coaches} schools={weekdaySchools} addRule={addRule} updateRule={updateRule} removeRule={removeRule} removeRules={removeRules} busy={busy} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No fixed coaches yet. Add the first one above.</p>
        )}
      </Card>
    </section>
  )
}

// One coach and every place they're fixed to. Each place is a chip: click it to switch the rule on or off.
function CoachCard({ coach, schoolById, coaches, schools, addRule, updateRule, removeRule, removeRules, busy }) {
  const [adding, setAdding] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const on = coach.rules.filter((r) => r.active).length
  return (
    <li className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-bold ${avatarFor(coach.name)}`} aria-hidden="true">
          {coach.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="truncate">{coach.name}</span>
            {EMPLOYMENT[coach.type] && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${EMPLOYMENT[coach.type][1]}`}>{EMPLOYMENT[coach.type][0]}</span>
            )}
          </h3>
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!!busy}
          aria-label={`Remove ${coach.name} from fixed coaches`}
          title="Remove this coach from fixed coaches"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 ring-1 ring-slate-200 transition-colors hover:bg-red-50 hover:text-red-600 hover:ring-red-200 disabled:opacity-50"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
      {confirming && (
        <ConfirmDialog title={`Remove ${coach.name}?`} confirmLabel="Remove coach" onConfirm={() => removeRules(coach.rules.map((r) => r.id))} onClose={() => setConfirming(false)}>
          {coach.name} will no longer be fixed anywhere. This removes {coach.rules.length === 1 ? 'their 1 place' : `all ${coach.rules.length} of their places`}:
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {coach.rules.map((r) => (
              <li key={r.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {r.base ? `${r.base} · ${dayList(r.days)}` : schoolById[r.school_id]?.name ?? 'Unknown school'}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
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
  const [confirming, setConfirming] = useState(false)
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
        onClick={() => setConfirming(true)}
        disabled={!!busy}
        className="mr-1 grid h-6 w-6 place-items-center rounded-full opacity-60 transition hover:bg-red-100 hover:text-red-600 hover:opacity-100"
      >
        <Close className="h-3.5 w-3.5" />
      </button>
      {confirming && (
        <ConfirmDialog title={`Remove ${name} from ${coachName}?`} onConfirm={() => removeRule(rule.id)} onClose={() => setConfirming(false)}>
          Auto-Generate will stop sending {coachName} to <b className="text-slate-800">{name}</b>
          {when ? ` (${when})` : ''}. Their other places stay.
        </ConfirmDialog>
      )}
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

// The two numbers, each as a sentence with the value in it, and underneath what they add up to for a
// few real class sizes - which is the thing people actually want to know before changing either one.
function NumbersPanel({ rules, addRule, updateRule, busy }) {
  const saved = (kind, fallback) => rules.find((r) => r.kind === kind)?.value ?? fallback
  const ratio = Number(saved('students_per_coach', 3))
  const max = Number(saved('max_coaches', 4))
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {NUMBERS.map(([kind, fallback, step, before, after, help]) => (
        // keyed by the saved value, so the box resets when a save is undone or the rule changes elsewhere
        <NumberRule
          key={`${kind}:${saved(kind, fallback)}`}
          rule={rules.find((r) => r.kind === kind)}
          kind={kind}
          fallback={fallback}
          step={step}
          before={before}
          after={after}
          help={help}
          addRule={addRule}
          updateRule={updateRule}
          busy={busy}
        />
      ))}
      <ClassSizes ratio={ratio} max={max} />
    </div>
  )
}

// Reads the two numbers back as coach counts, with the ones the max is holding down called out, so the
// ceiling is visible here rather than something you find out later on the roster.
function ClassSizes({ ratio, max }) {
  if (!(ratio > 0) || !(max > 0)) return null
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3.5">
      <p className="mb-2 text-xs text-slate-500">With these numbers, Auto-Generate aims for:</p>
      <ul className="flex flex-wrap gap-2">
        {CLASS_SIZES.map((students) => {
          const wanted = Math.ceil(students / ratio)
          const coaches = Math.min(max, wanted)
          const capped = coaches < wanted
          return (
            <li key={students} className={`rounded-lg border px-3 py-1.5 ${capped ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
              <span className="block text-sm font-bold tabular-nums text-slate-900">{students} students</span>
              <span className={`block text-xs font-semibold tabular-nums ${capped ? 'text-amber-700' : 'text-slate-500'}`}>
                {coaches} coach{coaches === 1 ? '' : 'es'}{capped ? ' · at the max' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// One number, as the sentence it finishes. Minus and plus move it by one step; the box also takes typing.
// Sends on a step, on losing focus or on Enter, and only if the number changed. A send that doesn't go
// through puts the saved number back in the box.
function NumberRule({ rule, kind, fallback, step, before, after, help, addRule, updateRule, busy }) {
  const saved = Number(rule?.value ?? fallback)
  const [text, setText] = useState(String(saved))
  const ok = (v) => Number.isFinite(v) && v >= 1 && v <= 20 && Number.isInteger(v / step)
  const send = async (v) => {
    if (!ok(v)) return setText(String(saved))
    setText(String(v))
    if (v === saved) return
    if (!(await (rule ? updateRule(rule.id, { value: v }) : addRule({ kind, value: v })))) setText(String(saved))
  }
  const typed = Number(text)
  const now = Number.isFinite(typed) && text !== '' ? typed : saved
  const nudge = (d) => send(Math.min(20, Math.max(1, Math.round((now + d * step) / step) * step)))
  const name = `${before} … ${after}`
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
      <span className="text-sm font-semibold text-slate-800">{before}</span>
      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 focus-within:border-indigo-400">
        <StepButton label={`Lower: ${name}`} onClick={() => nudge(-1)} disabled={!!busy || now <= 1}>{'−'}</StepButton>
        <input
          type="number"
          inputMode="decimal"
          min="1"
          max="20"
          step={step}
          aria-label={name}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => send(Number(text))}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          disabled={!!busy}
          className="w-14 bg-transparent text-center text-base font-bold tabular-nums text-slate-900 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <StepButton label={`Raise: ${name}`} onClick={() => nudge(1)} disabled={!!busy || now >= 20}>+</StepButton>
      </span>
      <span className="text-sm font-semibold text-slate-800">{after}</span>
      <p className="w-full text-xs text-slate-500">{help}</p>
    </div>
  )
}

function StepButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-md text-base font-bold leading-none text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
    >
      {children}
    </button>
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
  const ready = coachId && where && (!centre || days.length) && !busy

  // Centres first, then preschools; the lesson day is a tag on the right, so typing "fri" finds Friday schools too.
  const placeOptions = [
    ...CENTRES.map((c) => ({ value: c, label: c, hint: 'pick days', group: 'Centres' })),
    ...schools.map((s) => ({ value: s.id, label: s.name, hint: s.class_day, group: 'Preschools' })),
  ]
  const placeSelect = <SearchPick label="Preschool or centre" placeholder="Type or pick a preschool or centre…" options={placeOptions} value={where} onChange={setWhere} />
  const dayPicker = centre && (
    <span role="group" aria-label="Days" className="inline-flex flex-wrap gap-1">
      {DAYS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={days.includes(d)}
          onClick={() => toggle(d)}
          className={`h-9 w-11 rounded-lg text-xs font-semibold uppercase ring-1 transition-colors ${days.includes(d) ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-indigo-50'}`}
        >
          {d}
        </button>
      ))}
    </span>
  )
  const button = (
    <ActionButton
      action={add}
      label={fixedCoachId == null ? 'Add fixed coach' : 'Add'}
      working="Adding…"
      done="Added"
      failed="Couldn't add"
      disabled={!ready}
      className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
      size="rounded-lg px-4 py-2 text-sm font-semibold"
    />
  )

  // Inside a coach's card: just the place, the days and Add.
  if (fixedCoachId != null) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
        <div className="min-w-48 flex-1">{placeSelect}</div>
        {dayPicker}
        {button}
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white">
          <Plus className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-slate-900">Fix a coach to a place</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Coach</span>
          <SearchPick
            label="Coach"
            placeholder="Type or pick a coach…"
            options={coaches.map((c) => ({ value: c.id, label: c.name, hint: EMPLOYMENT[c.employment_type]?.[0] }))}
            value={coachId}
            onChange={setCoachId}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preschool or centre</span>
          {placeSelect}
        </div>
        <div className="md:pb-px">{button}</div>
      </div>
      {centre && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">On these days</span>
          {dayPicker}
        </div>
      )}
    </div>
  )
}
