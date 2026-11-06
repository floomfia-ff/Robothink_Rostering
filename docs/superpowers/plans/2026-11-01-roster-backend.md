# Roster Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the roster UI to the shared RoboThink Supabase and the lesson plan sheet through one Edge Function, so coaches, schools and slot counts are live and the admin's decisions are saved.

**Architecture:** A Supabase Edge Function `roster` (Deno) is the only thing the browser talks to; it checks a shared roster code, reads `coaches` / `schools` / `roster_bases` / `roster_weeks` with the service role, and reduces the lesson plan sheet to counts. All pure logic lives in two plain-JS modules beside the function so Node tests and the function share them. The UI keeps its screens; `src/lib/api.js` swaps localStorage for `fetch`, and field names change to the database's.

**Tech Stack:** React 19 + Vite + Tailwind (existing), Supabase Postgres + Edge Functions (Deno, `npm:@supabase/supabase-js@2`), Google Sheets API v4 with the existing service account, Node `node:assert` tests.

**Spec:** `docs/superpowers/specs/2026-11-01-roster-backend-design.md`

## Global Constraints

- No child's name may appear in any response from the function.
- Slot times and student counts for weekday lessons are never stored; always rebuilt from the sheet.
- The roster may write only: `coaches.mrt_station`, `coaches.employment_type`, `schools.address`, `roster_bases.address`, and `roster_weeks`.
- `employment_type` is `'intern'` or `'part-timer'`, default `'part-timer'`.
- Every function request needs header `x-roster-code` equal to secret `ROSTER_CODE`; otherwise `401 { "error": "Roster code not accepted." }`.
- Errors are non-2xx `{ "error": "Readable message" }`; `api.js` throws `new Error(body.error)`.
- Slot time format `"HH:MM - HH:MM"`, 24-hour.
- Week id is the Monday, `YYYY-MM-DD`; "current week" uses Singapore time (UTC+8).
- No new npm dependencies in the site. Tests stay plain Node (`npm test`).
- Code style follows the repo: no semicolons in `src/`, 2-space indent, short `//` comments on the why only.
- Database changes and deploys touch the shared production project `kfqaaehcjqzfqxhmtskg`: ask Matin before applying each one.

## Review Focus

1. Sheet school names that differ only by case or spaces ("MBR TOA PAYOH (THU)" vs "MBR Toa Payoh (Thu)") must match; truly different names must land in `unmatchedSchools`, never silently show 0. → Task 3 test `matches schools ignoring case and spaces`.
2. A child row with a blank class-time cell must still be counted, under a slot with `time: ''`, not dropped. → Task 3 test `blank class time is its own slot`.
3. A school whose date is past the end of its sheet year (no date column) is `noLesson: true`, not an error. → Task 3 test `no children that date is a holiday`.
4. Saving a week that references a coach id not in `coaches` returns 400 with a readable message, and nothing is written. → Task 3 test in `validateWeek`.
5. Addresses with trailing spaces ("…Singapore 609648 ") are valid; an address whose last token is a unit number ("…#02-01") is not. → Task 3 test `address check`.

---

## File Structure

| File | Responsibility |
|---|---|
| `sql/01_coach_employment_type.sql` | New column on shared `coaches` |
| `sql/02_roster_bases.sql` | `roster_bases` table + WCP/DV rows + RLS |
| `sql/03_roster_weeks.sql` | `roster_weeks` table + RLS |
| `supabase/functions/roster/plan.js` | Copied lesson plan parser (pure) |
| `supabase/functions/roster/plan.test.js` | Parser tests |
| `supabase/functions/roster/logic.js` | Week building, storing, validation (pure) |
| `supabase/functions/roster/logic.test.js` | Logic + privacy tests |
| `supabase/functions/roster/index.ts` | HTTP routing, auth, DB, Google fetch |
| `supabase/functions/roster/README.md` | Deploy steps and secrets |
| `src/data/mockRoster.json` | Test fixture, converted to new field names |
| `src/lib/roster.js` | Rule helpers, renamed fields, new `venueList` |
| `src/lib/roster.test.js` | Updated for renames |
| `src/lib/api.js` | `fetch` client with change detection |
| `src/context/RosterContext.jsx` | Wire new api, drop mock-only actions |
| `src/components/*.jsx`, `src/lib/export.js` | Renames and read-only rules from spec §5 |
| `docs/API_CONTRACT.md`, `README.md`, `.env.example` | Updated contract and setup |

`package.json` `test` script becomes:
`node src/lib/roster.test.js && node supabase/functions/roster/plan.test.js && node supabase/functions/roster/logic.test.js`

---

### Task 1: Database changes

**Files:**
- Create: `sql/01_coach_employment_type.sql`, `sql/02_roster_bases.sql`, `sql/03_roster_weeks.sql`

**Interfaces:**
- Produces: `coaches.employment_type text not null default 'part-timer'`; table `roster_bases(id serial, code text unique, name text, address text)`; table `roster_weeks(id date pk, status text, changed_since_publish boolean, data jsonb, updated_at timestamptz)`.

- [ ] **Step 1: Write the three SQL files** with the exact DDL from spec §4. Each file starts with a `select` that prints what it is about to change (feedback-project convention), e.g. `select count(*) as coaches_without_type from coaches;`. Files 02 and 03 end with `alter table … enable row level security;` and create no policies.

- [ ] **Step 2: Ask Matin, then apply** each file in order with the Supabase MCP `apply_migration` (names `roster_01_coach_employment_type`, `roster_02_bases`, `roster_03_weeks`).

- [ ] **Step 3: Verify**

Run (MCP `execute_sql`):
```sql
select column_name, column_default from information_schema.columns
 where table_name='coaches' and column_name='employment_type';
select code, address from roster_bases order by code;
select relname, relrowsecurity from pg_class where relname in ('roster_bases','roster_weeks');
```
Expected: one row with default `'part-timer'::text`; `DV` and `WCP` with the spec addresses; both tables `relrowsecurity = true`.

- [ ] **Step 4: Commit**
```bash
git add sql/
git commit -m "Add roster tables and coach employment type"
```

---

### Task 2: Lesson plan parser (copied)

**Files:**
- Create: `supabase/functions/roster/plan.js`
- Test: `supabase/functions/roster/plan.test.js`
- Modify: `package.json` (`test` script above)

**Interfaces:**
- Produces:
  - `serialToISO(value: unknown) -> string` (`''` when not a positive number)
  - `readDoubles(rows: unknown[][]) -> Set<string>`
  - `parsePlan(rows: unknown[][], today: string, doubles: Set<string>) -> School[]` where `School = { name, day, classStart, students: [{ name, level, time, type, start, end, trial, done: Build[], next, upcoming: Build[], total }] }`, `Build = { week, date, build, count }`
  - `normaliseTime(text: string) -> string`: `"1600 - 1700"` / `"16:00-17:00"` / `"1600-1700"` → `"16:00 - 17:00"`; anything else returned trimmed and unchanged.
  - Constants `TAB = 'Lesson Plan'`, `RANGE = 'A1:DZ800'`, `DOUBLES_TAB = 'Doubles'`, `DOUBLES_RANGE = 'A2:C200'`.

- [ ] **Step 1: Write the failing tests** in `plan.test.js` (plain `node:assert/strict`, style of `src/lib/roster.test.js`). Build a small `rows` array by hand: a band row `['ADVENTIST SCHOOLHOUSE', '', '', 'WED', 'Starts →', 46057]`, a header row with serials from column I (`46057, 46064`), two student rows (`[1, 'Kwok Xin Ning', 'K1', '1600 - 1700', 'R', 46057, '', '', 'L1-1A', 'L1-1B']`, a second child), a class-time total row `['', '1600 - 1700', 0]` and a `['ADVENTIST SCHOOLHOUSE Total to Bill']` row.
```js
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
assert.equal(P.normaliseTime('0930-1030'), '09:30 - 10:30')
assert.equal(P.normaliseTime('  TBC '), 'TBC')
```

- [ ] **Step 2: Run** `node supabase/functions/roster/plan.test.js` — Expected: FAIL (`Cannot find module …/plan.js`).

- [ ] **Step 3: Create `plan.js`** by copying `text`, `serialToISO`, `doublesKey`, `readDoubles`, `parsePlan` and the column constants from `C:\Users\Matin\Downloads\Internship_student_feedback_proj\supabase\functions\read-lesson-plan\index.ts`, removing the TypeScript types, and adding `normaliseTime`. Header comment: `// Copied from RoboThink-Feedback supabase/functions/read-lesson-plan/index.ts (2026-11-01). A parser fix there must be copied here, and the other way round.`

- [ ] **Step 4: Set the `test` script** to `node src/lib/roster.test.js && node supabase/functions/roster/plan.test.js` and run `npm test` — Expected: PASS. (Task 3 appends the logic tests.)

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/roster/plan.js supabase/functions/roster/plan.test.js package.json
git commit -m "Copy the lesson plan parser into the roster function"
```

---

### Task 3: Week building, storing and validation

**Files:**
- Create: `supabase/functions/roster/logic.js`
- Test: `supabase/functions/roster/logic.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `parsePlan` output (`School[]`), `normaliseTime` from Task 2.
- Produces (all pure, plain JS, no imports besides `./plan.js`):
  - `DAY_KEYS = ['mon','tue','wed','thu','fri','sat','sun']`
  - `isMonday(id: string) -> boolean`
  - `addDays(id: string, n: number) -> string`
  - `currentMonday(now: Date) -> string` — Monday of `now` in UTC+8
  - `weekShell(id) -> { id, label: '2-Nov to 8-Nov', status: 'draft', changedSincePublish: false, availability: {}, days: [{ key, label: 'MON', date: '2-Nov', blocks: [] }] × 7 }`
  - `matchSchools(schools: DbSchool[], plan: School[]) -> { byId: Map<number, School>, unmatched: string[] }` — case- and space-insensitive name match; `unmatched` lists active DB school names with no sheet block.
  - `lessonSlots(planSchool: School, date: string) -> Slot[]` where `Slot = { time, students, builds: [{ build, students }] }` — children with `start && start <= date`, `!end || end >= date`, and a build on `date`; grouped by `normaliseTime(time)`; slots sorted by time, builds by count desc then name.
  - `buildWeek({ id, coaches, schools, plan, planError, saved, previous }) -> Week` — `schools` all DB schools; `plan` is the `matchSchools` result or `null` when `planError`; `saved` / `previous` are `roster_weeks` rows (`{ id, status, changed_since_publish, data }`) or `null`. Implements spec §6 and §7 rows for holidays, inactive schools and inactive coaches. Lesson block: `{ id: \`${weekId}-${dayKey}-school-${schoolId}\`, kind: 'lesson', schoolId, name, slots, coaches, noLesson? , inactive? }`.
  - `toStored(week) -> data` — spec §4 shape: lessons reduced to `{ kind, schoolId, noLesson, coaches }`, weekend blocks whole.
  - `validateWeek(week, coachIds: Set<number>) -> string | null` — checks: `isMonday(week.id)`; 7 days with keys `DAY_KEYS`; every block coach id in `coachIds`; roles in `lead|coach|shadow`; availability values in `available|off|unavailable`, 7 per coach.
  - `isValidAddress(text) -> boolean` — trimmed text ends in 6 digits preceded by a space or start.
  - `pickFields(body: object, allowed: string[]) -> object` — keeps only allowed keys; `validateCoachFields(fields) -> string | null` (employment_type value, mrt_station is string or null).

- [ ] **Step 1: Write the failing tests** in `logic.test.js`. Use a hand-made `plan` with one school `MBR TOA PAYOH (THU)` whose students include `'Secret Child A'` (16:00 - 17:00, build `L1-2A` on `2026-11-05`), `'Secret Child B'` (same slot, `L1-3B`), `'Secret Child C'` (blank time, `L1-2A`), a child who left on `2026-10-01`, and a child starting `2026-12-01`.
```js
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

// weekend with no earlier week = OTHERS only; availability defaults to available
assert.deepEqual(wk.days[5].blocks.map((b) => b.kind), ['other'])
assert.deepEqual(wk.availability[String(coaches[0].id)], Array(7).fill('available'))

// saved decisions keep coaches, fresh counts replace stale ones
const saved = { id: '2026-11-02', status: 'published', changed_since_publish: false,
  data: L.toStored({ ...wk, days: wk.days.map((d) => d.key !== 'thu' ? d :
    { ...d, blocks: d.blocks.map((b) => b.schoolId === 5 ? { ...b, coaches: [{ id: 1, role: 'lead' }], slots: [{ time: 'x', students: 99 }] } : b) }) }) }
const merged = L.buildWeek({ id: '2026-11-02', coaches, schools: dbSchools, plan: m, planError: null, saved, previous: null })
const tp = merged.days[3].blocks.find((b) => b.schoolId === 5)
assert.deepEqual(tp.coaches, [{ id: 1, role: 'lead' }])
assert.equal(tp.slots.reduce((n, s) => n + s.students, 0), 3)
assert.equal(merged.status, 'published')
assert.ok(!JSON.stringify(saved.data).includes('students'), 'lesson counts are never stored')

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

// validation
assert.equal(L.isMonday('2026-11-02'), true)
assert.equal(L.isMonday('2026-11-03'), false)
assert.equal(L.validateWeek(merged, new Set(coaches.map((c) => c.id))), null)
assert.match(L.validateWeek(merged, new Set([2])), /coach 1/i)
assert.match(L.validateWeek({ ...merged, id: '2026-11-03' }, new Set([1])), /Monday/)

// address check
assert.equal(L.isValidAddress('90 Jurong East Street 13, Singapore 609648 '), true)
assert.equal(L.isValidAddress('12 Hoy Fatt Road, #02-01'), false)
assert.equal(L.isValidAddress(''), false)
assert.equal(L.validateCoachFields({ employment_type: 'manager' }) !== null, true)
assert.deepEqual(L.pickFields({ name: 'x', mrt_station: 'Yishun MRT' }, ['mrt_station', 'employment_type']), { mrt_station: 'Yishun MRT' })

// weekShell labels
assert.equal(L.weekShell('2026-11-02').label, '2-Nov to 8-Nov')
assert.equal(L.currentMonday(new Date('2026-11-08T17:00:00Z')), '2026-11-09') // already Monday in Singapore
```

- [ ] **Step 2: Run** `node supabase/functions/roster/logic.test.js` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `logic.js`** with the signatures above. Availability for a new week: copy `previous.data.availability`, then add `available ×7` for any coach id missing. Weekend blocks for a new week: `previous` weekend blocks with `coaches: []` and ids rewritten from `previous.id` to `id`, else one `{ id: \`${id}-${dayKey}-others\`, kind: 'other', name: 'OTHERS', slots: [], coaches: [] }` per weekend day. Block ordering on weekdays: by school name.

- [ ] **Step 4: Append** `&& node supabase/functions/roster/logic.test.js` to the `test` script and run `npm test` — Expected: all three test files PASS.

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/roster/logic.js supabase/functions/roster/logic.test.js
git commit -m "Build roster weeks from saved decisions and lesson plan counts"
```

---

### Task 4: The `roster` Edge Function

**Files:**
- Create: `supabase/functions/roster/index.ts`, `supabase/functions/roster/README.md`

**Interfaces:**
- Consumes: everything exported by `plan.js` and `logic.js`.
- Produces (HTTP, base `…/functions/v1/roster`):
  - `GET /` → `{ coaches, schools, bases, weeks, planError, unmatchedSchools }` — coaches: all, `select id,name,active,mrt_station,employment_type order by name`; schools: `id,name,brand,class_day,active,address` order by name; weeks: every saved week plus `currentMonday(new Date())` if not saved, ascending.
  - `GET /weeks/:id` → `Week` (400 if not a Monday)
  - `PUT /weeks/:id` body `Week` → `204`; validates with `validateWeek`; upserts `{ id, status, changed_since_publish, data: toStored(week), updated_at: now() }`, setting `changed_since_publish = true` when the stored row is `published`.
  - `POST /weeks/:id/publish` → `204`; 404 `{ error: 'Save the week before publishing it.' }` if no row.
  - `PATCH /coaches/:id` body `{ mrt_station?, employment_type? }` → `204`; 404 if no such coach.
  - `PATCH /schools/:id`, `PATCH /bases/:id` body `{ address }` → `204`; 400 if `!isValidAddress(address)`.
  - CORS: `Access-Control-Allow-Origin: *`, headers `content-type, x-roster-code`, methods `GET, PUT, POST, PATCH, OPTIONS`.

- [ ] **Step 1: Write `index.ts`.** Copy `getAccessToken` (+ `base64url`, `textToBase64url`) and the sheet fetch with its 403 / missing-tab messages from the feedback function; scope `spreadsheets.readonly`. Sheet failures set `planError` instead of failing `GET`. Routing by `new URL(req.url).pathname.replace(/^.*\/roster/, '')`. Check `x-roster-code` first (500 `ROSTER_CODE is not set on this function.` when the secret is missing). Wrap the handler in try/catch → `500 { error: message }`. Client: `createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))` from `npm:@supabase/supabase-js@2`.

- [ ] **Step 2: Write `README.md`**: secrets (`ROSTER_CODE`, reused `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_PLAN_SHEET_ID`), deploy with Verify JWT off, the curl checks below, and the note that `plan.js` is a copy.

- [ ] **Step 3: Ask Matin, then deploy** with the Supabase MCP `deploy_edge_function` (name `roster`, files `index.ts`, `plan.js`, `logic.js`, `verify_jwt: false`). Ask Matin to add `ROSTER_CODE` under Edge Functions → Secrets and tell you the value privately via `.env.local` (not in chat).

- [ ] **Step 4: Verify with curl** (`$URL` = function URL, `$CODE` from `.env.local`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" "$URL/"                             # 401
curl -s -H "x-roster-code: $CODE" "$URL/" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r.coaches.length,r.schools.length,r.bases.length,r.weeks.length,r.planError,r.unmatchedSchools)})"
curl -s -X PATCH -H "x-roster-code: $CODE" -H "content-type: application/json" -d '{"address":"no postcode"}' "$URL/schools/1"   # 400 message
curl -s -H "x-roster-code: $CODE" "$URL/weeks/2026-11-03"                    # 400 Monday message
```
Expected: `401`; `19 14 2 1 null []` (or the real counts, `planError` null); readable 400s.

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/roster/index.ts supabase/functions/roster/README.md
git commit -m "Add the roster Edge Function"
```

---

### Task 5: Renames in the rules, fixture and tests

**Files:**
- Modify: `src/data/mockRoster.json`, `src/lib/roster.js`, `src/lib/roster.test.js`

**Interfaces:**
- Consumes: `isValidAddress` from `supabase/functions/roster/logic.js`.
- Produces:
  - Coach shape `{ id: number, name, active, employment_type, mrt_station }` everywhere in `roster.js` (`c.type` → `c.employment_type`).
  - `venueList(roster) -> [{ kind: 'school' | 'base', id, name, address, days: string[] }]` — schools (active) then bases, `days` = day labels where a lesson block has that `schoolId` / a programme has that `base`.
  - `isValidAddress` re-exported from `roster.js`; `isValidPostalCode` and `nextWeek` (+ `rotateLead`) removed.

- [ ] **Step 1: Convert the fixture** with a one-off Node script (not committed): coach string ids → `1..15` in their current order, `type` → `employment_type`, `mrt` → `mrt_station`, add `active: true`; replace ids inside `blocks[].coaches` and the `availability` keys (as strings); `venues` → `schools` (`id` 1.., `name`, `brand` = first word, `class_day` = the weekday label it appears on, `active: true`, `address: ''`) excluding WCP/DV, plus `bases` `[{ id: 1, code: 'WCP', … }, { id: 2, code: 'DV', … }]`; lesson blocks gain `schoolId`.

- [ ] **Step 2: Update `roster.test.js`** to the new ids: replace each name literal (`'reyes'`, `'ameer'`, `'kathleen'`, `'matin'`, `'linette'`) with the id the script assigned, looked up once at the top: `const id = (name) => coaches.find((c) => c.name === name).id`. Add:
```js
assert.deepEqual(R.venueList({ schools, bases, weeks }).filter((v) => v.kind === 'base').map((v) => v.name), ['WCP', 'DV'])
assert.ok(R.venueList({ schools, bases, weeks }).find((v) => v.name === 'MBR Tanjong Pagar').days.includes('MON'))
```
Remove any test of `nextWeek`.

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (`venueList` shape / `employment_type`).

- [ ] **Step 4: Update `roster.js`** per the Produces block.

- [ ] **Step 5: Run** `npm test` — Expected: PASS, including the original week totals `[10, 5, 5, 10, 11, 7, 7]` and `[10, 5, 5, 10, 11, 7, 6]`.

- [ ] **Step 6: Commit**
```bash
git add src/data/mockRoster.json src/lib/roster.js src/lib/roster.test.js
git commit -m "Use the database's field names in the roster rules"
```

---

### Task 6: Real API client and context

**Files:**
- Modify: `src/lib/api.js`, `src/context/RosterContext.jsx`
- Create: `.env.example`

**Interfaces:**
- Consumes: Task 4 endpoints.
- Produces:
  - `api.loadRoster() -> Promise<Roster>`; `api.loadWeek(id) -> Promise<Week>`; `api.saveDraft(roster) -> Promise<void>`; `api.publishRoster(roster, weekId) -> Promise<void>`; `api.generateRoster(week, coaches)` unchanged. `resetToMock` removed.
  - Context value: `coaches` (active only), `coachById` (all), `venues` (from `venueList`), `planError`, `unmatchedSchools`, `updateVenue(kind, id, patch)`, `updateCoach(id, patch)`, `createWeek()` async via `loadWeek`. Removed: `createCoach`, `deleteCoach`, `removeVenue`, `resetToMock`.

- [ ] **Step 1: Rewrite `api.js`.** `const URL = import.meta.env.VITE_ROSTER_API_URL`, header `x-roster-code: import.meta.env.VITE_ROSTER_CODE`. One `request(method, path, body)` helper that throws `new Error(body.error || \`${status} ${statusText}\`)` on non-2xx. Keep a module-level `baseline = structuredClone(roster)` set after load and after each successful save; `saveDraft` sends PATCHes for coaches whose `mrt_station`/`employment_type` differ, schools/bases whose `address` differs, then PUT for weeks whose JSON differs from the baseline (new weeks have no baseline entry), in that order, stopping at the first error. Remove the fake delay.

- [ ] **Step 2: Update `RosterContext.jsx`**: initial week = the one with `id === currentMonday` if present, else the last; `createWeek` = `run('Creating', …)` calling `api.loadWeek(addDays(lastWeek.id, 7))` then appending; `updateVenue(kind, id, patch)` edits `r.schools` / `r.bases` by id; `autoGenerate` passes active coaches only.

- [ ] **Step 3: Write `.env.example`** with `VITE_ROSTER_API_URL=https://kfqaaehcjqzfqxhmtskg.supabase.co/functions/v1/roster` and `VITE_ROSTER_CODE=ask-matin`, plus a comment that the code is visible to anyone with the site (spec §8).

- [ ] **Step 4: Verify** `npm run build` — Expected: build succeeds (screens are updated in Task 7; fix only import errors here).

- [ ] **Step 5: Commit**
```bash
git add src/lib/api.js src/context/RosterContext.jsx .env.example
git commit -m "Load and save the roster through the roster function"
```

---

### Task 7: Screens

**Files:**
- Modify: `src/components/CoachProfiles.jsx`, `VenueProfiles.jsx`, `VenueRow.jsx`, `WeeklyGrid.jsx`, `HeaderControls.jsx`, `CoachChip.jsx`, `AvailabilityPanel.jsx`, `CoachSwapModal.jsx`, `src/lib/export.js`

**Interfaces:**
- Consumes: context value from Task 6.

- [ ] **Step 1: Renames**: `type` → `employment_type`, `mrt` → `mrt_station` in every file listed (find them with `grep -rn "\.type\b\|\.mrt\b" src`).

- [ ] **Step 2: Apply spec §5 "Screen behaviour that changes"**:
  - `CoachProfiles`: name shown as text; remove "+ Add coach" and "Remove".
  - `VenueProfiles`: rows from `venues`, keyed `${kind}-${id}`; name as text; drop the postal code column, add-venue form and Remove; address input calls `updateVenue(v.kind, v.id, { address })`, red with "Must end in a 6-digit postal code" when non-empty and `!isValidAddress`.
  - `VenueRow`: for `kind === 'lesson'`, render each slot's time and student count as text plus its builds (`L1-2A ×3`, one per line, small grey); hide add/remove slot and the remove-block button. Programmes unchanged. Show `(inactive)` after an inactive block's name.
  - `WeeklyGrid`: hide the add-block form on weekdays.
  - `CoachChip`: append ` (inactive)` when `coachById[id].active === false`.
  - `HeaderControls`: remove the Reset to mock button; show `planError` as a red banner "Lesson plan unavailable: {planError}" and `unmatchedSchools` as an amber line "Not found on the lesson plan: {names}".

- [ ] **Step 3: Verify** `npm test && npm run build` — Expected: PASS and build succeeds.

- [ ] **Step 4: Commit**
```bash
git add src/
git commit -m "Show live data on the roster screens"
```

---

### Task 8: Contract, README, end-to-end check, PR

**Files:**
- Modify: `docs/API_CONTRACT.md`, `README.md`

- [ ] **Step 1: Rewrite `docs/API_CONTRACT.md`** to the new shapes and endpoints (spec §4–§7): coach, school, base, week, block with `schoolId` and `builds`, the stored `data` shape, every endpoint and error, and the screen rules. Keep its existing section order (Data, Rules, Endpoints, Not done yet); "Not done yet" lists Google Maps (spec #2), engine, notifications.

- [ ] **Step 2: Update `README.md`**: `.env.local` setup from `.env.example`, `supabase/functions/roster/README.md` for deploying, `sql/` for database changes, and the `backend` branch.

- [ ] **Step 3: End-to-end check in the browser** (`preview_start` name `roster`, with `.env.local` filled):
  - the current week shows the 14 schools on their class days; pick one school and date and compare its slot counts with the feedback site's Print tab for the same date — must be equal;
  - no element on the page contains a child's name (check the network response for `GET /` too);
  - change one coach's MRT, Save, reload: it persists; it shows in the feedback site's Coaches tab (via `execute_sql select mrt_station …`); change it back;
  - set a wrong `VITE_ROSTER_CODE`, reload: "Couldn't load the roster. Roster code not accepted." Restore it.

- [ ] **Step 4: Commit, push, open the PR** into `front-end-ui`:
```bash
cd "C:/Users/Matin/Downloads/Robothink_Rostering"
git add docs/API_CONTRACT.md README.md
git commit -m "Update the API contract and README for the live backend"
git push
```
Open the PR on GitHub (no `gh` CLI on this machine): `https://github.com/floomfia-ff/Robothink_Rostering/compare/front-end-ui...backend`. Body: what changed, the screen behaviour changes for the UI owner to review, the SQL already applied, and the accepted risk from spec §8.
