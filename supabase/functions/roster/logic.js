// Pure helpers shared by the Edge Function, the tests and the browser: no Node or Deno imports.
import { normaliseTime } from './plan.js'

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86400000
// The supervisor's standard weekend, used when there is no earlier week to copy.
const WEEKEND_PROGRAMS = [['WCP Robotics (Regular)', 'WCP'], ['WCP Coding', 'WCP'], ['DV Robotics (Regular)', 'DV'],
  ['WCP Robotics (Dream)', 'WCP'], ['DV Robotics (Dream)', 'DV']]

export function isMonday(id) {
  const t = Date.parse(id)
  return /^\d{4}-\d\d-\d\d$/.test(id) && !isNaN(t) && new Date(t).toISOString().slice(0, 10) === id &&
    new Date(t).getUTCDay() === 1
}

export const addDays = (id, n) => new Date(Date.parse(id) + n * DAY_MS).toISOString().slice(0, 10)

// Singapore is UTC+8 with no daylight saving.
export function currentMonday(now) {
  const sg = new Date(now.getTime() + 8 * 3600000)
  return addDays(sg.toISOString().slice(0, 10), -((sg.getUTCDay() + 6) % 7))
}

const short = (iso) => `${+iso.slice(8)}-${MONTHS[+iso.slice(5, 7) - 1]}`

export const weekShell = (id) => ({
  id, label: `${short(id)} to ${short(addDays(id, 6))}`, status: 'draft', changedSincePublish: false, availability: {},
  days: DAY_KEYS.map((key, i) => ({ key, label: key.toUpperCase(), date: short(addDays(id, i)), blocks: [] })),
})

const norm = (s) => s.toLowerCase().replace(/\s+/g, '')

export function matchSchools(schools, plan) {
  const sheet = new Map(plan.map((p) => [norm(p.name), p]))
  const byId = new Map()
  const unmatched = []
  for (const s of schools) {
    const p = sheet.get(norm(s.name))
    if (p) byId.set(s.id, p)
    else if (s.active) unmatched.push(s.name)
  }
  return { byId, unmatched }
}

export function lessonSlots(planSchool, date) {
  const slots = new Map()
  for (const s of planSchool.students) {
    if (!s.start || s.start > date || (s.end && s.end < date)) continue
    const b = [...s.done, ...s.upcoming].find((x) => x.date === date)
    if (!b) continue
    const time = normaliseTime(s.time)
    const slot = slots.get(time) || { time, students: 0, builds: new Map() }
    slot.students++
    slot.builds.set(b.build, (slot.builds.get(b.build) || 0) + 1)
    slots.set(time, slot)
  }
  return [...slots.values()].sort((a, b) => a.time.localeCompare(b.time)).map((s) => ({
    ...s,
    builds: [...s.builds].map(([build, students]) => ({ build, students }))
      .sort((a, b) => b.students - a.students || a.build.localeCompare(b.build)),
  }))
}

export function buildWeek({ id, coaches, schools, plan, planError, saved, previous }) {
  const week = weekShell(id)
  if (saved) {
    week.status = saved.status
    week.changedSincePublish = saved.changed_since_publish
  }
  const base = (saved || previous)?.data.availability || {}
  // coaches can be hard-deleted by the feedback app; drop their ids so the page and PUT keep working
  const known = new Set(coaches.map((c) => c.id))
  const keep = (list) => list.filter((c) => known.has(c.id))
  // Interns carry their days over; part-timers are worked out from their placements below.
  for (const c of coaches) {
    if (c.employment_type === 'intern') week.availability[String(c.id)] = base[String(c.id)] || Array(7).fill('available')
  }

  week.days.forEach((day, i) => {
    const date = addDays(id, i)
    const savedDay = saved?.data.days.find((d) => d.key === day.key)
    if (i >= 5) {
      const prev = previous?.data.days.find((d) => d.key === day.key)
      day.blocks = savedDay ? savedDay.blocks.map((b) => ({ ...b, coaches: keep(b.coaches) }))
        : prev ? prev.blocks.map((b) => ({ ...b, id: b.id.replace(previous.id, id), coaches: [] }))
        : [...WEEKEND_PROGRAMS.map(([name, base]) => ({ id: `${id}-${day.key}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          kind: 'program', name, base, slots: [{ time: '09:00 - 16:00' }], coaches: [] })),
          { id: `${id}-${day.key}-others`, kind: 'other', name: 'OTHERS', slots: [], coaches: [] }]
      return
    }
    for (const s of schools.filter((x) => x.class_day === day.key.toUpperCase())) {
      const old = savedDay?.blocks.find((b) => b.kind === 'lesson' && b.schoolId === s.id)
      // an inactive school stays only on a published week that already had it
      if (!s.active && !(saved?.status === 'published' && old)) continue
      const p = plan?.byId.get(s.id)
      const slots = p ? lessonSlots(p, date) : []
      const block = { id: `${id}-${day.key}-school-${s.id}`, kind: 'lesson', schoolId: s.id, name: s.name, slots,
        coaches: keep(old?.coaches || []) }
      if (old?.noLesson) block.noLesson = true
      else if (p && !slots.length && !block.coaches.length) Object.assign(block, { noLesson: true, holiday: true }) // holiday: from the sheet, never stored; saved coaches mean the admin overrode it
      if (!s.active) block.inactive = true
      day.blocks.push(block)
    }
    day.blocks.sort((a, b) => a.name.localeCompare(b.name))
  })
  // Part-timers are X on every day they aren't placed: admins pick them in by hand, so nothing else carries over.
  for (const c of coaches) {
    if (c.employment_type === 'intern') continue
    week.availability[String(c.id)] = week.days.map((d) => (d.blocks.some((b) => b.coaches.some((x) => x.id === c.id)) ? 'available' : 'unavailable'))
  }
  return week
}

// Lesson names, slots and counts are rebuilt on every load, so they are never stored.
export const toStored = (week) => ({
  availability: week.availability,
  days: week.days.map((d) => ({ key: d.key, blocks: d.blocks.map((b) => b.kind !== 'lesson' ? b
    : { kind: 'lesson', schoolId: b.schoolId, noLesson: !!b.noLesson && !b.holiday, coaches: b.coaches }) })),
})

const ROLES = ['lead', 'coach', 'shadow']
const STATES = ['available', 'off', 'unavailable']

export function validateWeek(week, coachIds) {
  if (!isMonday(week.id)) return 'Week id must be a Monday (YYYY-MM-DD).'
  if (week.days?.length !== 7 || week.days.some((d, i) => d?.key !== DAY_KEYS[i])) return 'A week needs 7 days, Monday first.'
  if (week.days.some((d) => !Array.isArray(d.blocks) || d.blocks.some((b) => !b || !Array.isArray(b.coaches) || b.coaches.some((c) => !c)))) return 'Every day needs blocks, and every block needs coaches.'
  for (const b of week.days.flatMap((d) => d.blocks)) {
    if (b.kind === 'lesson' && !Number.isInteger(b.schoolId)) return 'Every lesson block needs a whole-number schoolId.'
    for (const c of b.coaches) {
      if (!coachIds.has(c.id)) return `Unknown coach ${c.id}.`
      if (!ROLES.includes(c.role)) return `Bad role "${c.role}" for coach ${c.id}.`
    }
  }
  for (const [cid, days] of Object.entries(week.availability || {})) {
    if (!coachIds.has(Number(cid))) return `Unknown coach ${cid}.`
    if (!Array.isArray(days) || days.length !== 7 || days.some((v) => !STATES.includes(v))) return `Bad availability for coach ${cid}.`
  }
  return null
}

export const isValidAddress = (text) => typeof text === 'string' && /(^|\s)\d{6}$/.test(text.trim())

export const pickFields = (body, allowed) =>
  Object.fromEntries(allowed.filter((k) => k in body).map((k) => [k, body[k]]))

export function validateCoachFields(f) {
  if ('employment_type' in f && !['intern', 'part-timer'].includes(f.employment_type)) return 'Employment type must be intern or part-timer.'
  if ('mrt_station' in f && f.mrt_station !== null && typeof f.mrt_station !== 'string') return 'MRT station must be text.'
  if ('can_lead' in f && typeof f.can_lead !== 'boolean') return 'Can lead must be true or false.'
  return null
}

// ---- roster rules ----

export const RULE_KINDS = ['fixed_coach', 'max_coaches', 'students_per_coach']

// `rules` are the stored rows; the row being edited (same id) is not a duplicate of itself.
export function validateRule(rule, { coachIds, schoolIds, rules }) {
  if (!RULE_KINDS.includes(rule.kind)) return 'Unknown rule kind.'
  if (rule.kind !== 'fixed_coach') {
    return Number.isInteger(rule.value) && rule.value >= 1 && rule.value <= 20 ? null : 'Value must be a whole number from 1 to 20.'
  }
  if (!coachIds.has(rule.coach_id)) return 'Unknown coach.'
  if (!schoolIds.has(rule.school_id)) return 'Unknown school.'
  const twin = rules.some((r) => r.id !== rule.id && r.kind === 'fixed_coach' && r.coach_id === rule.coach_id && r.school_id === rule.school_id)
  return twin ? 'That coach is already fixed at that school.' : null
}

// ---- travel times (OneMap) ----

// The last standalone 6-digit group: a unit number after the postcode doesn't fool it.
export const postcodeOf = (address) => [...String(address ?? '').matchAll(/(?:^|\D)(\d{6})(?!\d)/g)].at(-1)?.[1] ?? null

// "Sengkang" and "Sengkang MRT" both search as "Sengkang MRT".
export const stationQuery = (mrt) => (/mrt/i.test(mrt) ? mrt.trim() : `${mrt.trim()} MRT`)

const fromOf = (c) => c.active && c.mrt_station?.trim()
const currentRows = (rows, coaches, schools) => {
  const from = new Map(coaches.map((c) => [c.id, fromOf(c)]))
  const to = new Map(schools.filter((s) => s.active).map((s) => [s.id, postcodeOf(s.address)]))
  return rows.filter((r) => from.get(r.coach_id) === r.from_station && to.get(r.school_id) === r.to_postcode)
}

// Coach x school pairs with no current stored time (coaches without an MRT and schools without a postcode are skipped).
export function pendingPairs(coaches, schools, rows) {
  const done = new Set(currentRows(rows, coaches, schools).map((r) => `${r.coach_id}:${r.school_id}`))
  return coaches.filter(fromOf).flatMap((c) =>
    schools
      .filter((s) => s.active && postcodeOf(s.address) && !done.has(`${c.id}:${s.id}`))
      .map((s) => ({ coach_id: c.id, school_id: s.id, from_station: fromOf(c), to_postcode: postcodeOf(s.address) })),
  )
}

// Fastest itinerary in whole minutes, or null when OneMap found none.
export function routeMinutes(reply) {
  const durations = (reply?.plan?.itineraries ?? []).map((i) => i.duration).filter(Number.isFinite)
  return durations.length ? Math.round(Math.min(...durations) / 60) : null
}

export function travelMap(rows, coaches, schools) {
  const travelTimes = {}
  const unrecognised = new Set()
  for (const r of currentRows(rows, coaches, schools)) {
    travelTimes[r.coach_id] = { ...travelTimes[r.coach_id], [r.school_id]: r.minutes }
    if (r.status === 'station-not-found') unrecognised.add(r.coach_id)
  }
  return { travelTimes, unrecognisedStations: [...unrecognised] }
}
