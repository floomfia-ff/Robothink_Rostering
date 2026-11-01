// Pure roster rules. Everything here takes plain data, so the backend can mirror it.
// Mutating helpers (assign/add/remove/setRole/autoFill/setAvailability) expect a cloned week.

export const MAX_STUDENTS_PER_COACH = 6
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri']
export const INTERN_QUOTA = { weekdays: 4, weekend: 1 }

export const isWeekend = (dayKey) => !WEEKDAYS.includes(dayKey)
// Only weekday venue lessons have a Lead; weekend programmes and OTHERS don't.
export const needsLead = (block) => block.kind === 'lesson'
const dayIndex = (week, dayKey) => week.days.findIndex((d) => d.key === dayKey)
const getDay = (week, dayKey) => week.days.find((d) => d.key === dayKey)

// "15:30 - 16:30": 24-hour, start before end.
export function isValidSlotTime(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d) - ([01]\d|2[0-3]):([0-5]\d)$/.exec((time ?? '').trim())
  return !!m && m[1] + m[2] < m[3] + m[4]
}
export const isValidPostalCode = (code) => /^\d{6}$/.test(code ?? '') // Singapore

// Every place coaches report to: weekday venues (by name, across all weeks) plus the weekend bases.
// Returns [{ name, days, address, postalCode }] merged with saved details in roster.venues.
export function venueList(roster) {
  const days = new Map()
  for (const w of roster.weeks) for (const d of w.days) for (const b of d.blocks) {
    const name = b.kind === 'lesson' ? b.name : b.kind === 'program' ? b.base : null
    if (name) days.set(name, new Set(days.get(name)).add(d.label))
  }
  for (const v of roster.venues ?? []) if (!days.has(v.name)) days.set(v.name, new Set()) // added on Venues tab, not rostered yet
  const saved = Object.fromEntries((roster.venues ?? []).map((v) => [v.name, v]))
  return [...days].map(([name, set]) => ({ address: '', postalCode: '', ...saved[name], name, days: [...set] }))
}

export const availability = (week, coachId, dayKey) =>
  week.availability[coachId]?.[dayIndex(week, dayKey)] ?? 'unavailable'

// Weekday lessons and weekend programmes both use the ratio; programmes count students only once entered.
export function requiredCoaches(block) {
  if (block.kind === 'other' || block.noLesson) return 0
  const most = Math.max(0, ...block.slots.map((s) => Number(s.students) || 0))
  return Math.ceil(most / MAX_STUDENTS_PER_COACH)
}

// Shadows don't count towards the ratio (matches the spreadsheet counts).
export const countedCoaches = (block) => block.coaches.filter((c) => c.role !== 'shadow').length

export function blockStatus(block) {
  if (block.kind === 'other') return null
  if (block.noLesson) return { tone: 'grey', label: 'No lesson' }
  const need = requiredCoaches(block)
  const have = countedCoaches(block)
  if (have < need) return { tone: 'red', label: `Short ${need - have}` }
  if (block.kind === 'program' && block.coaches.length === 0) return { tone: 'grey', label: 'No class' }
  if (block.kind === 'lesson' && need === 0 && block.coaches.length === 0) return { tone: 'grey', label: 'No students' }
  if (needsLead(block) && !block.coaches.some((c) => c.role === 'lead')) return { tone: 'yellow', label: 'No lead' }
  return { tone: 'green', label: 'OK' }
}

export const placementOf = (day, coachId) => day.blocks.find((b) => b.coaches.some((c) => c.id === coachId))

// Weekdays: interns who are in but not at a venue report to WCP.
// Weekends: WCP / DV are the coaches across that base's programmes.
export function baseCoaches(week, dayKey, base, coaches) {
  const day = getDay(week, dayKey)
  if (base === 'WCP' && !isWeekend(dayKey)) {
    return coaches
      .filter((c) => c.type === 'intern' && availability(week, c.id, dayKey) === 'available' && !placementOf(day, c.id))
      .map((c) => ({ id: c.id, role: 'coach' }))
  }
  return day.blocks.filter((b) => b.kind === 'program' && b.base === base).flatMap((b) => b.coaches)
}

export function isWorking(week, dayKey, coach) {
  if (availability(week, coach.id, dayKey) !== 'available') return false
  if (placementOf(getDay(week, dayKey), coach.id)) return true
  return coach.type === 'intern' && !isWeekend(dayKey) // at WCP
}

export function dayTotals(week, dayKey, coaches) {
  const day = getDay(week, dayKey)
  const wcp = isWeekend(dayKey) ? 0 : baseCoaches(week, dayKey, 'WCP', coaches).length
  return {
    assigned: day.blocks.reduce((n, b) => n + countedCoaches(b), 0) + wcp,
    required: day.blocks.reduce((n, b) => n + requiredCoaches(b), 0),
    available: coaches.filter((c) => availability(week, c.id, dayKey) === 'available').length,
  }
}

// 'assigned' | 'free' | 'off' | 'unavailable', plus where they are.
export function coachDay(week, dayKey, coach) {
  const status = availability(week, coach.id, dayKey)
  if (status !== 'available') return { status }
  const block = placementOf(getDay(week, dayKey), coach.id)
  if (block) return { status: 'assigned', where: block.name }
  if (isWorking(week, dayKey, coach)) return { status: 'assigned', where: 'WCP' }
  return { status: 'free' }
}

export function quotaWarnings(week, coaches) {
  return coaches
    .filter((c) => c.type === 'intern')
    .map((c) => {
      const worked = week.days.filter((d) => isWorking(week, d.key, c))
      const weekdays = worked.filter((d) => !isWeekend(d.key)).length
      const weekend = worked.length - weekdays
      if (weekdays === INTERN_QUOTA.weekdays && weekend === INTERN_QUOTA.weekend) return null
      return `Intern ${c.name} is assigned to ${weekdays} weekday${weekdays === 1 ? '' : 's'} + ${weekend} weekend day${weekend === 1 ? '' : 's'}; needs ${INTERN_QUOTA.weekdays} weekdays + ${INTERN_QUOTA.weekend} weekend.`
    })
    .filter(Boolean)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Copy `source` into a new draft week starting 7 days after `latest` (so weeks never clash).
// Same venues, slots, students, availability and coaches; each weekday Lead passes to the next coach.
export function nextWeek(source, latest) {
  const start = new Date(`${latest.id}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() + 7)
  const id = start.toISOString().slice(0, 10)
  const dates = source.days.map((_, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`
  })
  const week = structuredClone(source)
  Object.assign(week, { id, label: `${dates[0]} to ${dates.at(-1)}`, status: 'draft' })
  delete week.changedSincePublish
  week.days.forEach((day, i) => {
    day.date = dates[i]
    for (const b of day.blocks) {
      b.id = b.id.replace(source.id, id)
      if (needsLead(b)) rotateLead(b)
    }
  })
  return week
}

function rotateLead(block) {
  const pool = block.coaches.filter((c) => c.role !== 'shadow')
  const i = pool.findIndex((c) => c.role === 'lead')
  if (i < 0 || pool.length < 2) return
  pool[i].role = 'coach'
  pool[(i + 1) % pool.length].role = 'lead'
}

// ---- edits (on a cloned week) ----

export const blockNameTaken = (day, name) => day.blocks.some((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase())

// Weekday: a venue lesson. Weekend: a programme at the WCP or DV base. OTHERS stays last.
export function addBlock(week, dayKey, name, base = 'WCP') {
  const day = getDay(week, dayKey)
  name = name.trim()
  if (!name || blockNameTaken(day, name)) return
  const block = isWeekend(dayKey)
    ? { name, kind: 'program', base, slots: [{ time: '09:00 - 16:00' }], coaches: [] }
    : { name, kind: 'lesson', slots: [{ time: '', students: 0 }], coaches: [] }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  block.id = `${week.id}-${dayKey}-${slug}-${Math.random().toString(36).slice(2, 7)}`
  const others = day.blocks.findIndex((b) => b.kind === 'other')
  day.blocks.splice(others < 0 ? day.blocks.length : others, 0, block)
}

export function removeBlock(week, dayKey, blockId) {
  const day = getDay(week, dayKey)
  day.blocks = day.blocks.filter((b) => b.id !== blockId)
}

// No Lesson frees the coaches (interns fall back to WCP).
export function setNoLesson(week, dayKey, blockId, on) {
  const block = getDay(week, dayKey).blocks.find((b) => b.id === blockId)
  if (on) {
    block.noLesson = true
    block.coaches = []
  } else delete block.noLesson
}

function findSlot(day, coachId) {
  for (const b of day.blocks) {
    const i = b.coaches.findIndex((c) => c.id === coachId)
    if (i >= 0) return { block: b, index: i }
  }
  return null
}

// Put newId into this position. If newId is placed elsewhere that day, the two coaches trade places.
// Roles stay with the position, so a Lead slot stays a Lead slot.
export function assignCoach(week, dayKey, blockId, index, newId) {
  const day = getDay(week, dayKey)
  const block = day.blocks.find((b) => b.id === blockId)
  const oldId = block.coaches[index].id
  const other = findSlot(day, newId)
  if (other) other.block.coaches[other.index].id = oldId
  block.coaches[index].id = newId
}

export function addCoach(week, dayKey, blockId, coachId) {
  const day = getDay(week, dayKey)
  const prev = findSlot(day, coachId)
  if (prev) prev.block.coaches.splice(prev.index, 1)
  const block = day.blocks.find((b) => b.id === blockId)
  const lead = needsLead(block) && !block.coaches.some((c) => c.role === 'lead')
  block.coaches.push({ id: coachId, role: lead ? 'lead' : 'coach' })
}

export function removeCoach(week, dayKey, blockId, index) {
  getDay(week, dayKey).blocks.find((b) => b.id === blockId).coaches.splice(index, 1)
}

export function setRole(week, dayKey, blockId, index, role) {
  const block = getDay(week, dayKey).blocks.find((b) => b.id === blockId)
  if (role === 'lead') block.coaches.forEach((c) => c.role === 'lead' && (c.role = 'coach'))
  block.coaches[index].role = role
}

// Setting a coach OFF / X also takes them off that day's venues.
export function setAvailability(week, dayKey, coachId, status) {
  week.availability[coachId][dayIndex(week, dayKey)] = status
  if (status === 'available') return
  const slot = findSlot(getDay(week, dayKey), coachId)
  if (slot) slot.block.coaches.splice(slot.index, 1)
}

// Fewest Leads this week wins; ties are random.
export function pickLead(pool, leadCount) {
  const fewest = Math.min(...pool.map((c) => leadCount[c.id] ?? 0))
  const tied = pool.filter((c) => (leadCount[c.id] ?? 0) === fewest)
  return tied[Math.floor(Math.random() * tied.length)]
}

// Draft fill: keep valid assignments, drop unavailable/double-booked coaches,
// top up short venues and programmes from free coaches, spread weekend leftovers across running programmes,
// keep interns to one weekend day unless a programme is short, and share Leads out evenly.
// shortcut: greedy and ignores home location; replace with the backend solver once postal codes are geocoded.
export function autoFill(week, coaches) {
  const byId = Object.fromEntries(coaches.map((c) => [c.id, c]))
  const leadCount = {}
  for (const d of week.days) for (const b of d.blocks) for (const c of b.coaches) {
    if (c.role === 'lead') leadCount[c.id] = (leadCount[c.id] ?? 0) + 1
  }

  for (const day of week.days) {
    const seen = new Set()
    for (const b of day.blocks) {
      b.coaches = b.coaches.filter((c) => {
        const ok = availability(week, c.id, day.key) === 'available' && !seen.has(c.id)
        seen.add(c.id)
        return ok
      })
    }
    // Part-timers only come in when free that day, so use them before pulling interns off WCP.
    let free = coaches
      .filter((c) => availability(week, c.id, day.key) === 'available' && !seen.has(c.id))
      .sort((a, b) => (a.type === b.type ? 0 : a.type === 'part-timer' ? -1 : 1))
      .map((c) => c.id)
    // Interns already on the other weekend day are kept back: only used if a programme is short.
    const otherWeekendDay = day.key === 'sat' ? 'sun' : 'sat'
    const isDouble = (id) => isWeekend(day.key) && byId[id].type === 'intern' && isWorking(week, otherWeekendDay, byId[id])
    const spare = free.filter(isDouble)
    free = free.filter((id) => !isDouble(id))

    for (const b of day.blocks.filter((x) => requiredCoaches(x) > 0)) {
      while (countedCoaches(b) < requiredCoaches(b) && (free.length || spare.length)) {
        b.coaches.push({ id: free.length ? free.shift() : spare.shift(), role: 'coach' })
      }
    }
    if (isWeekend(day.key)) {
      // Leftovers go to programmes that are running; only open an empty one if none are.
      const programs = day.blocks.filter((b) => b.kind === 'program')
      const running = programs.filter((b) => b.coaches.length || requiredCoaches(b))
      const targets = running.length ? running : programs
      while (free.length && targets.length) {
        const emptiest = targets.reduce((a, b) => (b.coaches.length < a.coaches.length ? b : a))
        emptiest.coaches.push({ id: free.shift(), role: 'coach' })
      }
    }
    for (const b of day.blocks) {
      const pool = b.coaches.filter((c) => c.role !== 'shadow')
      if (needsLead(b) && pool.length && !b.coaches.some((c) => c.role === 'lead')) {
        const lead = pickLead(pool, leadCount)
        lead.role = 'lead'
        leadCount[lead.id] = (leadCount[lead.id] ?? 0) + 1
      }
    }
  }
}
