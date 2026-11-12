// Run: npm test. Checks the rules against the real spreadsheets.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as R from './roster.js'

const { coaches, schools, bases, weeks } = JSON.parse(readFileSync(new URL('../data/mockRoster.json', import.meta.url)))
const id = (name) => coaches.find((c) => c.name === name).id
const totals = (w) => w.days.map((d) => R.dayTotals(w, d.key, coaches).assigned)

// No shadows in the mock, so every working coach counts (= the sheet's "Coaches Available" row).
assert.deepEqual(totals(weeks[0]), [10, 5, 5, 10, 11, 7, 7], 'week 1 totals')
assert.deepEqual(totals(weeks[1]), [10, 5, 5, 10, 11, 7, 6], 'week 2 totals')
for (const w of weeks) for (const d of w.days) for (const b of d.blocks) {
  assert.ok(b.coaches.every((c) => c.role !== 'shadow'), 'no shadows')
  const leads = b.coaches.filter((c) => c.role === 'lead').length
  assert.equal(leads, R.needsLead(b) && b.coaches.length ? 1 : 0, `${b.id} lead count`)
}
assert.deepEqual(R.baseCoaches(weeks[0], 'mon', 'WCP', coaches).map((c) => c.id), [id('Reyes'), id('Linette')])
assert.deepEqual(R.quotaWarnings(weeks[0], coaches), [], 'week 1 meets intern quota')
assert.deepEqual(R.quotaWarnings(weeks[1], coaches), [], 'week 2 meets intern quota')
// an intern's weekday off must be Tuesday or Wednesday
let q = structuredClone(weeks[0])
const qa = id('Ameer')
const offDay = q.days.findIndex((d) => !R.isWeekend(d.key) && R.availability(q, qa, d.key) !== 'available')
R.setAvailability(q, q.days[offDay].key, qa, 'available')
R.setAvailability(q, 'thu', qa, 'off')
assert.match(R.quotaWarnings(q, coaches).join(' '), /Ameer's weekday off is Thursday; it must be Tuesday or Wednesday/)
for (const w of weeks) for (const d of w.days) for (const b of d.blocks) {
  assert.notEqual(R.blockStatus(b)?.tone, 'red', `${w.id} ${d.key} ${b.name} staffed`)
}

// swap: Reyes (WCP on Mon) replaces Ameer at Tanjong Pagar -> Ameer goes to WCP
let w = structuredClone(weeks[0])
const tp = w.days[0].blocks[0]
R.assignCoach(w, 'mon', tp.id, 0, id('Reyes'))
assert.equal(tp.coaches[0].id, id('Reyes'))
assert.equal(tp.coaches[0].role, 'lead')
assert.ok(R.baseCoaches(w, 'mon', 'WCP', coaches).some((c) => c.id === id('Ameer')))

// swap between two venues trades places
R.assignCoach(w, 'mon', tp.id, 1, id('Kathleen'))
assert.equal(w.days[0].blocks[1].coaches[0].id, id('Matin'))

// removing two of Dover's 3 coaches makes it short (9 students needs 2); auto-fill tops up from WCP
w = structuredClone(weeks[0])
const dover = w.days[0].blocks[1]
R.removeCoach(w, 'mon', dover.id, 0)
R.removeCoach(w, 'mon', dover.id, 0)
assert.equal(R.countedCoaches(dover), 1)
assert.notEqual(R.blockStatus(dover).tone, 'red', 'no coach cap: a school with few coaches is never red')
assert.equal('required' in R.dayTotals(w, 'mon', coaches), false, 'no required count is shown')
R.autoFill(w, coaches)
assert.ok(R.countedCoaches(dover) >= R.requiredCoaches(dover), 'auto-fill still quietly tops up to 1 per 6')
assert.ok(w.days.filter((d) => R.isWeekend(d.key)).every((d) => d.blocks.every((b) => b.coaches.every((c) => c.role !== 'lead'))), 'auto-fill adds no weekend leads')

// OFF removes the coach from the venue and triggers a quota warning
w = structuredClone(weeks[0])
R.setAvailability(w, 'tue', id('Kathleen'), 'off')
assert.ok(!w.days[1].blocks[0].coaches.some((c) => c.id === id('Kathleen')))
assert.match(R.quotaWarnings(w, coaches)[0], /Kathleen is assigned to 3 weekdays/)

console.log('roster rules: all checks passed')

// slot time + address validation
assert.ok(R.isValidSlotTime('15:30 - 16:30'))
assert.ok(!R.isValidSlotTime('16:30 - 15:30'), 'end before start')
assert.ok(!R.isValidSlotTime('3:30 - 4:30'), 'needs HH:MM')
assert.ok(!R.isValidSlotTime(''))
assert.equal(R.mondayOf('2026-11-25'), '2026-11-23') // Wednesday
assert.equal(R.mondayOf('2026-11-23'), '2026-11-23') // Monday stays
assert.equal(R.mondayOf('2026-11-29'), '2026-11-23') // Sunday belongs to the week before
assert.ok(R.isValidAddress('1 Fusionopolis Way 138632'))
assert.ok(!R.isValidAddress('1 Fusionopolis Way'))
console.log('validation: all checks passed')

// venue list: every active school once (Toa Payoh is Thu + Fri) plus the WCP / DV bases; an address on the school row shows through
const vl = R.venueList({ schools, bases, weeks })
assert.equal(vl.length, 14)
assert.deepEqual(vl.find((v) => v.name === 'MBR Toa Payoh').days, ['THU', 'FRI'])
assert.deepEqual(vl.find((v) => v.name === 'DV').days, ['SAT', 'SUN'])
assert.deepEqual(vl.filter((v) => v.kind === 'base').map((v) => v.name), ['WCP', 'DV'])
assert.ok(vl.find((v) => v.name === 'MBR Tanjong Pagar').days.includes('MON'))
const saved = structuredClone(schools)
saved[0].address = '1 Raffles Quay 048583'
assert.equal(R.venueList({ schools: saved, bases, weeks })[0].address, '1 Raffles Quay 048583')
assert.equal(R.venueList({ schools: saved.map((s) => ({ ...s, active: false })), bases, weeks }).length, 2, 'inactive schools are hidden')
console.log('venues: all checks passed')

// venues per day: add, duplicate guard, No Lesson, remove
w = structuredClone(weeks[0])
R.addBlock(w, 'tue', 'MBR Bishan')
R.addBlock(w, 'tue', ' mbr bishan ')
const tue = w.days[1].blocks
assert.equal(tue.filter((b) => b.name === 'MBR Bishan').length, 1, 'no duplicate venue on a day')
assert.equal(tue.at(-1).kind, 'lesson')
assert.equal(R.blockStatus(tue.at(-1)).label, 'No students', 'new empty venue is grey, not No lead')
R.addBlock(w, 'sat', 'DV Coding', 'DV')
assert.equal(w.days[5].blocks.at(-1).kind, 'other', 'OTHERS stays last')
assert.equal(w.days[5].blocks.at(-2).base, 'DV')
const creative = w.days[3].blocks[1]
R.setNoLesson(w, 'thu', creative.id, true)
assert.equal(creative.coaches.length, 0)
assert.equal(R.blockStatus(creative).label, 'No lesson')
assert.ok(R.baseCoaches(w, 'thu', 'WCP', coaches).length === 3, 'Creative coaches go to WCP')
R.setNoLesson(w, 'thu', creative.id, false)
assert.ok(!('noLesson' in creative))
creative.holiday = true
R.setNoLesson(w, 'thu', creative.id, true)
assert.ok(!('holiday' in creative), 'admin toggle replaces a sheet-derived holiday')
R.setNoLesson(w, 'thu', creative.id, false)
R.removeBlock(w, 'tue', tue.at(-1).id)
assert.ok(!w.days[1].blocks.some((b) => b.name === 'MBR Bishan'))
const withSaved = { schools: [...schools, { id: 99, name: 'MBR Bishan', brand: 'MBR', class_day: 'TUE', active: true, address: '' }], bases, weeks }
assert.deepEqual(R.venueList(withSaved).find((v) => v.name === 'MBR Bishan').days, [], 'school with no lessons listed')
console.log('venues per day: all checks passed')

// Excel export mirrors the supervisor's sheet
const { default: ExcelJS } = await import('exceljs')
const { buildRosterSheet, sheetCells } = await import('./export.js')
const wb = new ExcelJS.Workbook()
buildRosterSheet(wb, weeks[0], coaches)
const back = new ExcelJS.Workbook()
await back.xlsx.load(await wb.xlsx.writeBuffer()) // must survive a save / reopen
const ws = back.worksheets[0]
const v = (r, c) => ws.getCell(r, c).value
assert.deepEqual([v(1, 1), v(1, 2), v(2, 2), v(1, 14)], ['* Lead Coach', 'MON', '19-Oct', 'SUN'])
assert.ok(ws.getCell(1, 3).isMerged, 'day header spans text + count columns')
assert.equal(v(4, 2), 'MBR Tanjong Pagar')
assert.equal(ws.getCell(4, 2).fill.fgColor.argb, 'FFCCCCFF', 'Monday venue is lavender')
assert.match(v(5, 2), /^\d{4} - \d{4}$/, 'times written like 1530 - 1630')
assert.equal(typeof v(5, 3), 'number')
const rowOf = (label) => ws.getColumn(1).values.indexOf(label)
assert.deepEqual([3, 5, 7, 9, 11, 13, 15].map((c) => v(rowOf('Total Coaches'), c)), [10, 5, 5, 10, 11, 7, 7])
const ameer = rowOf('Ameer')
assert.deepEqual([v(ameer, 2), v(ameer, 3), v(ameer, 4), v(ameer, 14)], ['Ameer', 1, 'OFF', 'OFF'])
assert.ok(ws.getColumn(2).values.some((x) => /^\*\w/.test(x ?? '')), 'leads marked with *')
assert.ok(['WCP', 'DV', 'OTHERS'].every((b) => ws.getColumn(2).values.includes(b)))
// builds go under the time rows, with their student counts
const withBuilds = structuredClone(weeks[0])
const tpb = withBuilds.days[0].blocks.find((b) => b.name === 'MBR Tanjong Pagar')
tpb.slots[0].builds = [{ build: 'L2-9 New Gear Ratio', students: 3 }]
const bs = buildRosterSheet(new ExcelJS.Workbook(), withBuilds, coaches)
const buildRow = bs.getColumn(2).values.indexOf('L2-9 New Gear Ratio')
assert.ok(buildRow > 4 + tpb.slots.length, 'build listed below the times')
assert.equal(bs.getCell(buildRow, 3).value, 3)
console.log('export: all checks passed')

// the picture is drawn from the same sheet: merged headers span, fills and bold carry over
const cells = sheetCells(ws)
assert.equal(cells[0][0].value, '* Lead Coach')
assert.deepEqual([cells[0][1].value, cells[0][1].span], ['MON', 2], 'day header spans text + count')
const tpCell = cells[3].find((c) => c.value === 'MBR Tanjong Pagar')
assert.deepEqual([tpCell.bg, tpCell.bold], ['#CCCCFF', true])
assert.equal(cells[0].reduce((n, c) => n + c.span, 0), 15, 'every row covers all 15 columns')
console.log('picture cells: all checks passed')

// weekend programmes take only coach names: students never ask auto-fill for coaches
w = structuredClone(weeks[0])
const coding = w.days[5].blocks[1] // WCP Coding, nobody on Sat 24-Oct
assert.equal(R.blockStatus(coding).label, 'No class')
coding.slots[0].students = 8
assert.equal(R.requiredCoaches(coding), 0, 'weekend student numbers are ignored')
w.availability[id('Suzanne')][5] = 'available'
R.autoFill(w, coaches)
assert.ok(w.days[5].blocks.some((b) => b.kind === 'program' && b.coaches.some((c) => c.id === id('Suzanne'))), 'a free coach is still spread onto a running programme')

// auto-fill splits coaches free on both weekend days evenly between Saturday and Sunday
w = structuredClone(weeks[0])
for (const d of w.days.slice(5)) for (const b of d.blocks) b.coaches = []
for (const c of coaches) w.availability[c.id].splice(5, 2, 'available', 'available')
R.autoFill(w, coaches)
const onDay = (k) => new Set(w.days.find((d) => d.key === k).blocks.flatMap((b) => b.coaches.map((c) => c.id)))
const [satIds, sunIds] = [onDay('sat'), onDay('sun')]
assert.ok(Math.abs(satIds.size - sunIds.size) <= 1, `weekend split ${satIds.size} / ${sunIds.size}`)
assert.ok(satIds.size > 0 && [...satIds].every((id) => !sunIds.has(id)), 'each coach works one weekend day')

// auto-fill gives every intern without days off one Tue/Wed off and one weekend day off (4 + 1), split evenly
w = structuredClone(weeks[0])
const interns = coaches.filter((c) => c.employment_type === 'intern')
for (const c of interns) w.availability[c.id] = Array(7).fill('available')
for (const d of w.days.slice(5)) for (const b of d.blocks) b.coaches = [] // weekend placements already made are kept, so start clean
R.autoFill(w, coaches)
assert.deepEqual(R.quotaWarnings(w, coaches), [], 'every intern ends up on 4 weekdays + 1 weekend day')
const offOn = (k) => interns.filter((c) => R.availability(w, c.id, k) === 'off').length
assert.equal(offOn('tue') + offOn('wed'), interns.length, 'weekday off is always Tue or Wed')
assert.ok(Math.abs(offOn('tue') - offOn('wed')) <= 1, `Tue/Wed split ${offOn('tue')} / ${offOn('wed')}`)
assert.ok(Math.abs(offOn('sat') - offOn('sun')) <= 1, `Sat/Sun split ${offOn('sat')} / ${offOn('sun')}`)

// auto-fill takes the nearest free coach for a weekday school; unknown times go last
w = structuredClone(weeks[0])
const dover2 = w.days[0].blocks[1]
dover2.coaches = []
const [farId, nearId] = R.baseCoaches(w, 'mon', 'WCP', coaches).map((c) => c.id) // two interns free on Monday
R.autoFill(w, coaches, { [nearId]: { [dover2.schoolId]: 10 }, [farId]: { [dover2.schoolId]: 50 } })
assert.equal(dover2.coaches[0].id, nearId, 'nearest coach placed first')
// ...but a free part-timer still goes before interns, even when an intern is nearer
w = structuredClone(weeks[0])
const dover3 = w.days[0].blocks[1]
dover3.coaches = []
const suzanne = id('Suzanne')
w.availability[suzanne][0] = 'available'
R.autoFill(w, coaches, { [nearId]: { [dover3.schoolId]: 10 }, [suzanne]: { [dover3.schoolId]: 60 } })
assert.equal(dover3.coaches[0].id, suzanne, 'part-timer first, nearest within the group')
// rules: students on a Monday school are set by hand so targets are known
const kids = (b, n) => Object.assign(b, { noLesson: false, holiday: false, slots: [{ time: '15:00 - 16:00', students: n, builds: [] }] })
const freeMon = (wk) => R.baseCoaches(wk, 'mon', 'WCP', coaches).map((c) => c.id) // interns at WCP on Monday
const fresh = () => {
  const wk = structuredClone(weeks[0])
  for (const b of wk.days[0].blocks) b.coaches = []
  for (const b of wk.days[0].blocks.slice(2)) b.noLesson = true // tests use the first two Monday schools only
  return wk
}
assert.deepEqual(R.ruleSettings([]), { ratio: 3, max: 4, fixed: [], centre: [] })
assert.deepEqual(R.ruleSettings([{ kind: 'max_coaches', value: 2, active: false }, { kind: 'students_per_coach', value: 5, active: true }]), { ratio: 5, max: 4, fixed: [], centre: [] })

// the busier school takes the nearer coach
w = fresh()
let [first, second] = w.days[0].blocks
kids(first, 3)
kids(second, 12)
R.autoFill(w, coaches.filter((c) => c.id === nearId || c.id === farId), { [nearId]: { [first.schoolId]: 10, [second.schoolId]: 10 }, [farId]: { [first.schoolId]: 50, [second.schoolId]: 50 } })
assert.ok(second.coaches.some((c) => c.id === nearId), 'busier school picked first')
// short on coaches: every school gets one before the busiest gets a second
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 3)
kids(second, 12)
const three = freeMon(w).slice(0, 3)
R.autoFill(w, coaches.filter((c) => three.includes(c.id)))
assert.deepEqual([R.countedCoaches(first), R.countedCoaches(second)], [1, 2], 'kids per coach decides who picks next')
// 8 students -> 3 coaches; never more than the max; the rest stay at WCP
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 8)
kids(second, 30)
R.autoFill(w, coaches)
assert.equal(R.countedCoaches(first), 3, '8 kids -> 3 coaches')
assert.equal(R.countedCoaches(second), 4, '30 kids -> capped at 4')
assert.ok(freeMon(w).length > 0, 'leftovers stay at WCP')
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 8)
kids(second, 30)
R.autoFill(w, coaches, {}, [{ kind: 'max_coaches', value: 2, active: true }])
assert.equal(R.countedCoaches(second), 2, 'max from the rules')
// a fixed coach goes to their school first, even when nearer to another
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 6)
kids(second, 6)
const fixedId = freeMon(w)[0]
const fixedRule = { kind: 'fixed_coach', coach_id: fixedId, school_id: second.schoolId, active: true }
R.autoFill(w, coaches, { [fixedId]: { [first.schoolId]: 5, [second.schoolId]: 90 } }, [fixedRule])
assert.ok(second.coaches.some((c) => c.id === fixedId), 'fixed coach at their school')
assert.deepEqual(R.ruleWarnings(w, coaches, [fixedRule]), [], 'no warnings when the rules are met')
// a fixed coach is never swapped away
const other = second.coaches.find((c) => c.id !== fixedId)
if (other) {
  const t = { [fixedId]: { [first.schoolId]: 1, [second.schoolId]: 99 }, [other.id]: { [first.schoolId]: 99, [second.schoolId]: 1 } }
  w = fresh()
  ;[first, second] = w.days[0].blocks
  kids(first, 6)
  kids(second, 6)
  R.autoFill(w, coaches, t, [fixedRule])
  assert.ok(second.coaches.some((c) => c.id === fixedId), 'fixed coach not swapped')
}
// a fixed coach whose school has no lesson that day is free for others, with no warning
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 6)
second.noLesson = true
R.autoFill(w, coaches, {}, [fixedRule])
assert.equal(R.ruleWarnings(w, coaches, [fixedRule]).length, 0, 'no lesson: nothing to warn about')
// warnings: fixed coach off / elsewhere, too many coaches
w = fresh()
;[first, second] = w.days[0].blocks
kids(second, 6)
R.setAvailability(w, 'mon', fixedId, 'off')
assert.match(R.ruleWarnings(w, coaches, [fixedRule]).join(' '), new RegExp(`is fixed at ${second.name} but is off\\.`))
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 6)
kids(second, 6)
R.addCoach(w, 'mon', first.id, fixedId)
assert.match(R.ruleWarnings(w, coaches, [fixedRule]).join(' '), new RegExp(`is fixed at ${second.name} but is at ${first.name}\\.`))
for (const cid of freeMon(w).slice(0, 5)) R.addCoach(w, 'mon', second.id, cid)
R.autoFill(w, coaches, {}, [])
assert.ok(R.countedCoaches(second) >= 5, 'hand placements over the max are kept')
assert.match(R.ruleWarnings(w, coaches, []).join(' '), new RegExp(`${second.name} has \\d+ coaches, more than the max of 4\\.`))
// one coach fixed at two schools on one day: first school by name wins, the other warns
w = fresh()
;[first, second] = w.days[0].blocks
kids(first, 6)
kids(second, 6)
const both = [{ ...fixedRule, school_id: first.schoolId }, fixedRule]
R.autoFill(w, coaches, {}, both)
const [byName] = [first, second].sort((a, b) => a.name.localeCompare(b.name))
assert.ok(byName.coaches.some((c) => c.id === fixedId), 'first school by name wins')
assert.equal(R.ruleWarnings(w, coaches, both).filter((m) => m.includes('is fixed at')).length, 1)
// an intern fixed at a Tuesday school never gets Tuesday as their weekday off
w = structuredClone(weeks[0])
R.clearCoaches(w) // only the rule decides, not earlier hand placements
const tueSchool = kids(w.days[1].blocks[0], 6)
const fixedIntern = coaches.find((c) => c.employment_type === 'intern')
for (const c of coaches.filter((x) => x.employment_type === 'intern')) w.availability[c.id] = Array(7).fill('available')
for (const c of coaches.filter((x) => x.employment_type === 'intern' && x.id !== fixedIntern.id)) w.availability[c.id][2] = 'off' // Wed already busier, so Tue would be picked
R.autoFill(w, coaches, {}, [{ kind: 'fixed_coach', coach_id: fixedIntern.id, school_id: tueSchool.schoolId, active: true }])
assert.equal(R.availability(w, fixedIntern.id, 'tue'), 'available', 'fixed day is not their day off')
assert.equal(R.availability(w, fixedIntern.id, 'wed'), 'off')
// rules for a coach who isn't in the list (inactive) are ignored, with no warning
w = fresh()
kids(w.days[0].blocks[0], 6)
const ghost = [{ kind: 'fixed_coach', coach_id: 99999, school_id: w.days[0].blocks[0].schoolId, active: true }]
R.autoFill(w, coaches, {}, ghost)
assert.deepEqual(R.ruleWarnings(w, coaches, ghost), [])
// two coaches trade schools when that shortens their trips together (one at a time would send q 100 min)
w = structuredClone(weeks[0])
for (const b of w.days[0].blocks) b.coaches = []
const [a1, a2] = w.days[0].blocks
for (const b of [a1, a2]) b.slots = b.slots.map((s) => ({ ...s, students: 3 })) // one coach each
for (const b of w.days[0].blocks.slice(2)) b.noLesson = true // just the two schools
const pair = coaches.filter((c) => c.id === nearId || c.id === farId)
R.autoFill(w, pair, { [nearId]: { [a1.schoolId]: 10, [a2.schoolId]: 11 }, [farId]: { [a1.schoolId]: 12, [a2.schoolId]: 100 } })
assert.deepEqual([a1.coaches.map((c) => c.id), a2.coaches.map((c) => c.id)], [[farId], [nearId]], 'swapped to the shorter total')
// no travel map keeps the old order
const ta = structuredClone(weeks[0])
const tb = structuredClone(weeks[0])
R.autoFill(ta, coaches)
R.autoFill(tb, coaches, {})
const placements = (x) => x.days.flatMap((d) => d.blocks.map((b) => b.coaches.map((c) => c.id).sort().join(',')))
assert.deepEqual(placements(ta), placements(tb), 'no travel times: same placements as before')

// experienced coaches: every weekday school gets one first and they lead
w = structuredClone(weeks[0])
for (const d of w.days.slice(0, 5)) for (const b of d.blocks) b.coaches = []
const seasoned = new Set([id('Ameer'), id('Kathleen')])
const ranked = coaches.map((c) => ({ ...c, can_lead: seasoned.has(c.id) }))
R.autoFill(w, ranked)
for (const d of w.days.slice(0, 5)) {
  const lessons = d.blocks.filter((b) => b.kind === 'lesson' && R.requiredCoaches(b) > 0)
  const seasonedFree = [...seasoned].filter((cid) => R.availability(w, cid, d.key) === 'available').length
  const covered = lessons.filter((b) => b.coaches.some((c) => seasoned.has(c.id)))
  assert.equal(covered.length, Math.min(lessons.length, seasonedFree), `${d.key}: an experienced coach at as many schools as possible`)
  for (const b of covered) assert.ok(seasoned.has(b.coaches.find((c) => c.role === 'lead').id), `${d.key} ${b.name}: Lead is experienced`)
  if (seasonedFree <= lessons.length) assert.ok(covered.every((b) => b.coaches.filter((c) => seasoned.has(c.id)).length === 1), `${d.key}: one Lead Coach per school`)
  for (const b of lessons) assert.ok(R.countedCoaches(b) <= 4, `${d.key} ${b.name}: never more than 4`)
}
// a Lead who isn't a Lead Coach is a warning
const tp2 = w.days[0].blocks.find((b) => b.coaches.some((c) => c.role === 'lead'))
const leadId = tp2.coaches.find((c) => c.role === 'lead').id
const unmarked = ranked.map((c) => (c.id === leadId ? { ...c, can_lead: false } : c))
assert.match(R.leadWarnings(w, unmarked).join(' '), /is a Beginner/)
assert.deepEqual(R.leadWarnings(w, ranked).filter((m) => m.includes(tp2.name)), [])

// levels: Advanced gives exactly the old Lead Coach roster
const blank = structuredClone(weeks[0])
for (const d of blank.days.slice(0, 5)) for (const b of d.blocks) b.coaches = []
const leveled = coaches.map((c) => ({ ...c, coach_level: seasoned.has(c.id) ? 'advanced' : 'beginner' }))
const viaLevel = structuredClone(blank)
R.autoFill(viaLevel, leveled)
// Leads among equals are picked at random, so compare who goes where.
assert.deepEqual(placements(viaLevel), placements(w), 'Advanced = old Lead Coach, same placements')
assert.equal(R.coachLevel({ can_lead: true }), 'advanced', 'no level saved yet: old toggle decides')
assert.equal(R.coachLevel({ can_lead: true, coach_level: 'beginner' }), 'beginner', 'saved level wins')

// no Advanced at all: Intermediates spread one per school and lead; Beginners never lead over them
const mids = new Set([id('Ameer'), id('Kathleen')])
const midLevels = coaches.map((c) => ({ ...c, coach_level: mids.has(c.id) ? 'intermediate' : 'beginner' }))
const wm = structuredClone(blank)
R.autoFill(wm, midLevels)
for (const d of wm.days.slice(0, 5)) {
  const lessons = d.blocks.filter((b) => b.kind === 'lesson' && R.requiredCoaches(b) > 0)
  const midFree = [...mids].filter((cid) => R.availability(wm, cid, d.key) === 'available').length
  const covered = lessons.filter((b) => b.coaches.some((c) => mids.has(c.id)))
  assert.equal(covered.length, Math.min(lessons.length, midFree), `${d.key}: an Intermediate at as many schools as possible`)
  for (const b of covered) assert.ok(mids.has(b.coaches.find((c) => c.role === 'lead').id), `${d.key} ${b.name}: Intermediate leads`)
}
assert.ok(R.leadWarnings(wm, midLevels).every((m) => !mids.has(coaches.find((c) => m.includes(`Lead ${c.name} `))?.id)), 'Intermediate Lead is no warning')

// Advanced first, Intermediate only where no Advanced is left
const mixed = coaches.map((c) => ({ ...c, coach_level: c.id === id('Ameer') ? 'advanced' : c.id === id('Kathleen') ? 'intermediate' : 'beginner' }))
const wx = structuredClone(blank)
R.autoFill(wx, mixed)
for (const d of wx.days.slice(0, 5)) for (const b of d.blocks) {
  const ids = b.coaches.map((c) => c.id)
  if (ids.includes(id('Ameer')) && ids.includes(id('Kathleen')) && d.blocks.filter((x) => x.kind === 'lesson' && R.requiredCoaches(x) > 0).length > 1)
    assert.fail(`${d.key} ${b.name}: Advanced and Intermediate stacked while another school had neither`)
  if (ids.includes(id('Ameer'))) assert.equal(b.coaches.find((c) => c.role === 'lead')?.id, id('Ameer'), `${d.key} ${b.name}: Advanced leads`)
}

// clear coaches empties every block of the week but keeps availability
w = structuredClone(weeks[0])
const before = structuredClone(w.availability)
R.clearCoaches(w)
assert.ok(w.days.every((d) => d.blocks.every((b) => b.coaches.length === 0)))
assert.deepEqual(w.availability, before)

// fair leads: fewest Leads this week wins
const pool = [{ id: 1 }, { id: 2 }, { id: 3 }]
assert.equal(R.pickLead(pool, { 1: 2, 2: 0, 3: 1 }).id, 2)
assert.ok([2, 3].includes(R.pickLead(pool, { 1: 1 }).id))

// one weekend day per intern: Ameer works Sat; making him free on Sun doesn't put him on Sun too
w = structuredClone(weeks[0])
w.availability[id('Ameer')][6] = 'available'
R.autoFill(w, coaches)
assert.ok(!R.placementOf(w.days[6], id('Ameer')), 'Ameer kept off Sunday')
assert.deepEqual(R.quotaWarnings(w, coaches), [])
console.log('weekend + auto-fill: all checks passed')

// drag-and-drop move + auto-generate diff
{
  const w = structuredClone(weeks[0])
  const tp = w.days[0].blocks[0] // MBR Tanjong Pagar: Ameer (lead), Matin, Pei Qi
  const dover = w.days[0].blocks.find((b) => b.name === 'MBR Dover')
  R.moveCoach(w, 'mon', id('Matin'), dover.id)
  assert.ok(dover.coaches.some((c) => c.id === id('Matin')) && !tp.coaches.some((c) => c.id === id('Matin')), 'moved to Dover')
  R.moveCoach(w, 'mon', id('Matin'), dover.id) // same block: no-op
  assert.equal(dover.coaches.filter((c) => c.id === id('Matin')).length, 1)
  R.moveCoach(w, 'mon', id('Matin'), null)
  assert.ok(!R.placementOf(w.days[0], id('Matin')), 'back to WCP')
  assert.ok(R.baseCoaches(w, 'mon', 'WCP', coaches).some((c) => c.id === id('Matin')))

  // drop on a coach: swap places, Lead stays with the school
  const s = structuredClone(weeks[0])
  const [stp, sdover] = [s.days[0].blocks[0], s.days[0].blocks.find((b) => b.name === 'MBR Dover')]
  const dLead = sdover.coaches.find((c) => c.role === 'lead').id
  R.swapCoaches(s, 'mon', id('Matin'), dLead)
  assert.equal(sdover.coaches.find((c) => c.role === 'lead').id, id('Matin'), 'Matin leads Dover')
  assert.ok(stp.coaches.some((c) => c.id === dLead && c.role === 'coach'), 'Dover lead now a coach at Tanjong Pagar')
  R.swapCoaches(s, 'mon', id('Reyes'), id('Matin')) // Reyes is at WCP: takes Matin's spot, Matin goes to WCP
  assert.equal(sdover.coaches.find((c) => c.role === 'lead').id, id('Reyes'))
  assert.ok(!R.placementOf(s.days[0], id('Matin')), 'Matin back at WCP')
  R.swapCoaches(s, 'mon', id('Matin'), id('Linette')) // both at base: nothing to swap
  assert.ok(!R.placementOf(s.days[0], id('Matin')) && !R.placementOf(s.days[0], id('Linette')))

  const before = structuredClone(weeks[0])
  const after = structuredClone(before)
  after.days[0].blocks[0].coaches = after.days[0].blocks[0].coaches.filter((c) => c.role !== 'lead') // Ameer removed
  after.days[0].blocks[0].coaches[0].role = 'lead' // Matin promoted
  after.days[0].blocks[0].coaches.push({ id: id('Reyes'), role: 'coach' })
  const d = R.diffAssignments(before, after)
  assert.deepEqual(d.added, [`${tp.id}:${id('Reyes')}`])
  assert.deepEqual(d.removed, [`${tp.id}:${id('Ameer')}`])
  assert.deepEqual(d.newLeads, [`${tp.id}:${id('Matin')}`])
}
console.log('move + diff: all checks passed')

// fixed at a centre (WCP / DV) on picked days
{
  const rule = (name, base, days) => ({ kind: 'fixed_coach', coach_id: id(name), base, days, active: true })
  // weekday: Ameer stays at WCP on Monday, even though he was at Tanjong Pagar; the school still gets a Lead
  let w = structuredClone(weeks[0])
  const rules = [rule('Ameer', 'WCP', ['mon'])]
  assert.ok(R.ruleWarnings(w, coaches, rules).some((m) => /Ameer is fixed at WCP but is at MBR Tanjong Pagar/.test(m)))
  R.autoFill(w, coaches, {}, rules)
  assert.ok(!R.placementOf(w.days[0], id('Ameer')), 'Ameer kept at WCP on Monday')
  assert.ok(w.days[0].blocks[0].coaches.some((c) => c.role === 'lead'), 'Tanjong Pagar still has a Lead')
  assert.ok(!R.ruleWarnings(w, coaches, rules).some((m) => /Ameer is fixed/.test(m)))

  // weekend: Kaezel goes to a DV programme on Saturday
  w = structuredClone(weeks[0])
  for (const k of ['sat', 'sun']) for (const b of w.days.find((d) => d.key === k).blocks) b.coaches = []
  R.autoFill(w, coaches, {}, [rule('Kaezel', 'DV', ['sat'])])
  const at = R.placementOf(w.days[5], id('Kaezel'))
  assert.ok(at?.kind === 'program' && at.base === 'DV', `Kaezel in a DV programme on Saturday, got ${at?.name}`)

  // a centre day is never picked as the intern's day off: Reyes fixed at WCP on Tuesday gets Wednesday off
  w = structuredClone(weeks[0])
  w.availability[id('Reyes')] = Array(7).fill('available')
  for (const d of w.days) for (const b of d.blocks) b.coaches = b.coaches.filter((c) => c.id !== id('Reyes'))
  R.autoFill(w, coaches, {}, [rule('Reyes', 'WCP', ['tue'])])
  assert.equal(R.availability(w, id('Reyes'), 'tue'), 'available')
  assert.equal(R.availability(w, id('Reyes'), 'wed'), 'off')

  // preschool rules still read the same, and an Off centre rule does nothing
  assert.deepEqual(R.ruleSettings([rule('Ameer', 'WCP', ['mon']), { kind: 'fixed_coach', coach_id: 1, school_id: 2 }]).fixed, [{ coach_id: 1, school_id: 2 }])
  w = structuredClone(weeks[0])
  R.autoFill(w, coaches, {}, [{ ...rule('Ameer', 'WCP', ['mon']), active: false }])
  assert.ok(R.placementOf(w.days[0], id('Ameer')), 'Off rule ignored')
}
console.log('centre rules: all checks passed')

