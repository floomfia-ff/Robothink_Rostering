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
assert.equal(R.blockStatus(dover).tone, 'red')
R.autoFill(w, coaches)
assert.equal(R.blockStatus(dover).tone, 'green')
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
const { buildRosterSheet } = await import('./export.js')
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
console.log('export: all checks passed')

// weekend programmes: student count drives the ratio; empty + no students stays "No class"
w = structuredClone(weeks[0])
const coding = w.days[5].blocks[1] // WCP Coding, nobody on Sat 24-Oct
assert.equal(R.blockStatus(coding).label, 'No class')
coding.slots[0].students = 8
assert.equal(R.blockStatus(coding).label, 'Short 2')
R.autoFill(w, coaches)
assert.equal(R.blockStatus(coding).tone, 'red', 'everyone on Sat is already placed, so it stays short')
coding.slots[0].students = 5
w.availability[id('Suzanne')][5] = 'available'
R.autoFill(w, coaches)
assert.equal(R.blockStatus(coding).tone, 'green', 'auto-fill staffs a short programme from free coaches')
assert.ok(coding.coaches.some((c) => c.id === id('Suzanne')))

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
// ...unless a Sunday programme is short and nobody else is free
w.days[6].blocks[4].slots[0].students = 30 // DV Robotics (Dream): needs 5
R.autoFill(w, coaches)
assert.ok(R.placementOf(w.days[6], id('Ameer')), 'Ameer used when Sunday is short')
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

