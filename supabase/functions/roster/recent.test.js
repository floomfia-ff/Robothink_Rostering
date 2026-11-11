// Run: npm test. Checks which weeks count as recent.
import assert from 'node:assert/strict'
import { isRecent, recentCutoff } from './recent.js'

// Thursday 2026-11-12 in Singapore: Monday is 2026-11-09, minus 8 weeks is 2026-09-14
assert.equal(recentCutoff(new Date('2026-11-12T04:00:00Z')), '2026-09-14')
// Sunday 17:00 UTC is already Monday in Singapore
assert.equal(recentCutoff(new Date('2026-11-08T17:00:00Z')), '2026-09-14')
assert.equal(recentCutoff(new Date('2026-11-08T15:00:00Z')), '2026-09-07')

assert.equal(isRecent('2026-09-14', '2026-09-14'), true)
assert.equal(isRecent('2026-09-07', '2026-09-14'), false)
assert.equal(isRecent('2027-01-04', '2026-09-14'), true)
console.log('recent.test.js passed')
