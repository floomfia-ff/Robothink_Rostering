// Run: npm test. Checks the lesson plan parser on a hand-built sheet.
import assert from 'node:assert/strict'
import * as P from './plan.js'

const rows = [
  ['ADVENTIST SCHOOLHOUSE', '', '', 'WED', 'Starts →', 46057],
  ['S/N', 'Name', 'Level', 'Time', 'Type', 'Start Date', 'End', 'Trial', 46057, 46064],
  [1, 'Kwok Xin Ning', 'K1', '1600 - 1700', 'R', 46057, '', '', 'L1-1A', 'L1-1B'],
  [2, 'Second Child', 'K2', '1600 - 1700', 'R', 46057, '', '', 'L1-1A', 'L1-1B'],
  ['', '1600 - 1700', 0],
  ['ADVENTIST SCHOOLHOUSE Total to Bill'],
]

assert.equal(P.serialToISO(46057), '2026-02-04')
assert.equal(P.serialToISO('x'), '')
const schools = P.parsePlan(rows, '2026-02-05', new Set())
assert.equal(schools.length, 1)
assert.equal(schools[0].students.length, 2, 'class-time total rows are not children')
assert.deepEqual(schools[0].students[0].done.map((b) => b.build), ['L1-1A'])
assert.equal(schools[0].students[0].next.build, 'L1-1B')
const dbl = P.readDoubles([['Adventist Schoolhouse', 'Kwok Xin Ning', 46064]])
assert.equal(P.parsePlan(rows, '2026-02-05', dbl)[0].students[0].upcoming[0].count, 2)
assert.equal(P.normaliseTime('1600 - 1700'), '16:00 - 17:00')
assert.equal(P.normaliseTime('16:00-17:00'), '16:00 - 17:00')
assert.equal(P.normaliseTime('0930-1030'), '09:30 - 10:30')
assert.equal(P.normaliseTime('  TBC '), 'TBC')
console.log('plan ok')
