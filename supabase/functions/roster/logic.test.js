// Run: npm test. Checks week building, storing and validation.
import assert from 'node:assert/strict'
import * as L from './logic.js'

const child = (name, time, build, extra = {}) => ({ name, level: 'K1', time, type: 'R', start: '2026-01-01', end: '',
  trial: false, done: [], next: null, upcoming: [{ week: 1, date: '2026-11-05', build, count: 1 }], total: 1, ...extra })
const plan = [{ name: 'MBR TOA PAYOH (THU)', day: 'THU', classStart: '2026-01-01', students: [
  child('Secret Child A', '1600 - 1700', 'L1-2A'),
  child('Secret Child B', '16:00-17:00', 'L1-3B'),
  child('Secret Child C', '', 'L1-2A'),
  child('Left Child', '1600 - 1700', 'L1-2A', { end: '2026-10-01' }),
  child('Future Child', '1600 - 1700', 'L1-2A', { start: '2026-12-01' }),
] }]

const coaches = [{ id: 1, name: 'Ameer', active: true, employment_type: 'intern', mrt_station: 'Bukit Batok MRT' },
                 { id: 2, name: 'Matin', active: true, employment_type: 'part-timer', mrt_station: null }]

// matches schools ignoring case and spaces
const dbSchools = [{ id: 5, name: 'MBR Toa Payoh (Thu)', class_day: 'THU', active: true, address: '' },
                   { id: 6, name: 'MBR Nowhere', class_day: 'THU', active: true, address: '' }]
const m = L.matchSchools(dbSchools, plan)
assert.equal(m.byId.get(5).name, 'MBR TOA PAYOH (THU)')
assert.deepEqual(m.unmatched, ['MBR Nowhere'])

// blank class time is its own slot; left / not-started children excluded
const slots = L.lessonSlots(m.byId.get(5), '2026-11-05')
assert.deepEqual(slots.map((s) => [s.time, s.students]), [['', 1], ['16:00 - 17:00', 2]])
assert.deepEqual(slots[1].builds, [{ build: 'L1-2A', students: 1 }, { build: 'L1-3B', students: 1 }])

// no children that date is a holiday
const wk = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: m, planError: null, saved: null, previous: null })
const thu = wk.days.find((d) => d.key === 'thu')
assert.equal(thu.blocks.find((b) => b.schoolId === 5).noLesson, undefined)
const wk2 = L.buildWeek({ id: '2026-11-09', coaches, schools: dbSchools, plan: m, planError: null, saved: null, previous: null })
assert.equal(wk2.days[3].blocks.find((b) => b.schoolId === 5).noLesson, true)

// a sheet holiday is not stored, so it clears once the sheet gets a lesson that day
const holidaySaved = { id: '2026-11-09', status: 'draft', changed_since_publish: false, data: L.toStored(wk2) }
const lessonLater = [{ ...plan[0], students: [child('Secret Child A', '1600 - 1700', 'L1-2A', { upcoming: [{ week: 2, date: '2026-11-12', build: 'L1-2A', count: 1 }] })] }]
const reopened = L.buildWeek({ id: '2026-11-09', coaches, schools: dbSchools, plan: L.matchSchools(dbSchools, lessonLater), planError: null, saved: holidaySaved, previous: null })
assert.equal(reopened.days[3].blocks.find((b) => b.schoolId === 5).noLesson, undefined)

// weekend with no earlier week = the standard programmes + OTHERS; availability defaults to available
for (const day of wk.days.slice(5)) {
  assert.deepEqual(day.blocks.map((b) => b.name), ['WCP Robotics (Regular)', 'WCP Coding', 'DV Robotics (Regular)', 'WCP Robotics (Dream)', 'DV Robotics (Dream)', 'OTHERS'])
  assert.ok(day.blocks.every((b) => b.coaches.length === 0))
  assert.deepEqual(day.blocks.slice(0, 5).map((b) => b.base), ['WCP', 'WCP', 'DV', 'WCP', 'DV'])
}
assert.deepEqual(wk.availability[String(coaches[0].id)], Array(7).fill('available'))

// part-timers start every new week unavailable (admins pick them in by hand); interns carry over
assert.deepEqual(wk.availability['2'], Array(7).fill('unavailable'), 'part-timer starts as X')
const lastWeek = { id: '2026-10-26', status: 'draft', changed_since_publish: false,
  data: { availability: { 1: ['available', 'off', ...Array(4).fill('available'), 'off'], 2: Array(7).fill('available') }, days: [] } }
const nextWk = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: null, planError: 'x', saved: null, previous: lastWeek })
assert.deepEqual(nextWk.availability['1'], lastWeek.data.availability[1], "intern's days off carry over")
assert.deepEqual(nextWk.availability['2'], Array(7).fill('unavailable'), 'part-timer back to X in a new week')
const savedWk = L.buildWeek({ id: '2026-10-26', coaches, schools: dbSchools, plan: null, planError: 'x', saved: lastWeek, previous: null })
assert.deepEqual(savedWk.availability['2'], Array(7).fill('available'), 'a saved week keeps what the admin picked')

// saved decisions keep coaches, fresh counts replace stale ones
const saved = { id: '2026-11-02', status: 'published', changed_since_publish: false,
  data: L.toStored({ ...wk, days: wk.days.map((d) => d.key !== 'thu' ? d :
    { ...d, blocks: d.blocks.map((b) => b.schoolId === 5 ? { ...b, coaches: [{ id: 1, role: 'lead' }], slots: [{ time: 'x', students: 99 }] } : b) }) }) }
const merged = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: m, planError: null, saved, previous: null })
const tp = merged.days[3].blocks.find((b) => b.schoolId === 5)
assert.deepEqual(tp.coaches, [{ id: 1, role: 'lead' }])
assert.equal(tp.slots.reduce((n, s) => n + s.students, 0), 3)
assert.equal(merged.status, 'published')
assert.ok(!JSON.stringify(saved.data.days.flatMap((d) => d.blocks).filter((b) => b.kind === 'lesson')).includes('students'), 'lesson counts are never stored')

// sheet failure: slots empty, not a holiday
const failed = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: null, planError: 'boom', saved: null, previous: null })
assert.deepEqual(failed.days[3].blocks.find((b) => b.schoolId === 5).slots, [])
assert.equal(failed.days[3].blocks.find((b) => b.schoolId === 5).noLesson, undefined)

// inactive school: dropped from drafts, kept (marked) on published weeks
const closed = dbSchools.map((s) => s.id === 5 ? { ...s, active: false } : s)
assert.ok(!L.buildWeek({ id: '2026-11-02', coaches, schools: closed, plan: m, planError: null, saved: null, previous: null })
  .days[3].blocks.some((b) => b.schoolId === 5))
assert.equal(L.buildWeek({ id: '2026-11-02', coaches, schools: closed, plan: m, planError: null, saved, previous: null })
  .days[3].blocks.find((b) => b.schoolId === 5).inactive, true)

// privacy: no child's name anywhere in a built week
for (const name of ['Secret Child A', 'Secret Child B', 'Secret Child C']) {
  assert.ok(!JSON.stringify(merged).includes(name), `${name} leaked`)
}

// a coach deleted from the database (id 99) is dropped from saved lesson and weekend blocks
const ghost = structuredClone(saved)
ghost.data.days[3].blocks.find((b) => b.schoolId === 5).coaches.push({ id: 99, role: 'coach' })
ghost.data.days[5].blocks[0].coaches = [{ id: 99, role: 'lead' }, { id: 2, role: 'coach' }]
const deGhosted = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: m, planError: null, saved: ghost, previous: null })
assert.ok(!JSON.stringify(deGhosted.days.flatMap((d) => d.blocks)).includes('"id":99'), 'deleted coach dropped')
assert.deepEqual(deGhosted.days[5].blocks[0].coaches, [{ id: 2, role: 'coach' }])
assert.equal(L.validateWeek(deGhosted, new Set(coaches.map((c) => c.id))), null)

// a sheet holiday the admin overrode (coaches assigned, No lesson off) stays a lesson on reload
const overrode = structuredClone(holidaySaved)
overrode.data.days[3].blocks.find((b) => b.schoolId === 5).coaches = [{ id: 1, role: 'lead' }]
assert.equal(L.buildWeek({ id: '2026-11-09', coaches, schools: dbSchools, plan: m, planError: null, saved: overrode, previous: null })
  .days[3].blocks.find((b) => b.schoolId === 5).noLesson, undefined)

// validation
assert.equal(typeof L.validateWeek({ ...merged, days: merged.days.map((d) => ({ key: d.key })) }, new Set([1, 2])), 'string')
assert.equal(L.isMonday('2026-11-02'), true)
assert.equal(L.isMonday('2026-11-03'), false)
assert.equal(typeof L.validateWeek({ ...merged, days: merged.days.map((d) => ({ ...d, blocks: [null] })) }, new Set([1, 2])), 'string')
assert.equal(typeof L.validateWeek({ ...merged, days: merged.days.map((d) => ({ ...d, blocks: [{ coaches: [null] }] })) }, new Set([1, 2])), 'string')
assert.equal(L.validateWeek(merged, new Set(coaches.map((c) => c.id))), null)
assert.match(L.validateWeek(merged, new Set([2])), /coach 1/i)
assert.match(L.validateWeek({ ...merged, id: '2026-11-03' }, new Set([1])), /Monday/)
const badSchool = structuredClone(merged)
badSchool.days[3].blocks.find((b) => b.schoolId === 5).schoolId = '5'
assert.match(L.validateWeek(badSchool, new Set([1, 2])), /schoolId/)

// address check
assert.equal(L.isValidAddress('90 Jurong East Street 13, Singapore 609648 '), true)
assert.equal(L.isValidAddress('12 Hoy Fatt Road, #02-01'), false)
assert.equal(L.isValidAddress(''), false)
assert.equal(L.validateCoachFields({ employment_type: 'manager' }) !== null, true)
assert.deepEqual(L.pickFields({ name: 'x', mrt_station: 'Yishun MRT' }, ['mrt_station', 'employment_type']), { mrt_station: 'Yishun MRT' })

// weekShell labels
assert.equal(L.weekShell('2026-11-02').label, '2-Nov to 8-Nov')
// active school with no sheet block: no slots, not a holiday
const nowhere = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: m, planError: null, saved: null, previous: null })
  .days[3].blocks.find((b) => b.schoolId === 6)
assert.deepEqual(nowhere.slots, [])
assert.equal(nowhere.noLesson, undefined)

assert.equal(L.currentMonday(new Date('2026-11-08T17:00:00Z')), '2026-11-09') // already Monday in Singapore
console.log('logic ok')
