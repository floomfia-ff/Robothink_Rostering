# Roster Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Rules tab (fixed coaches, students per coach, max coaches per school) stored in Supabase, and an Auto-Generate weekday fill that follows those rules.

**Architecture:** Rules are rows in a new `roster_rules` table, read and written only by the `roster` Edge Function (`GET /` returns them; `POST/PATCH/DELETE /rules`). The pure check `validateRule` lives in `logic.js` (shared by Deno and Node tests). The pure fill `autoFill(week, coaches, travel, rules)` and `ruleWarnings` live in `src/lib/roster.js`. The page talks to the function through `src/lib/api.js`, holds rules in `RosterContext`, and edits them on `RulesTab.jsx`.

**Tech Stack:** React 19, Vite, Tailwind 4, Supabase Postgres + Deno Edge Function, plain Node `assert` tests (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-06-roster-rules-design.md`

## Global Constraints

- Code style: no semicolons, 2-space indent, short why-comments only. Files are CRLF: edit with the Edit tool or a node script that keeps line endings.
- Rule kinds, exactly: `fixed_coach`, `max_coaches`, `students_per_coach`. Numbers are whole, 1–20.
- Defaults when a number rule is missing or off: `students_per_coach` 3, `max_coaches` 4.
- Target per weekday school: `min(max, ceil(largest slot's students / ratio))`.
- Coaches not needed stay unplaced (WCP). Fixed coaches and the max are never broken by Auto-Generate.
- Warning texts: `"<DAY> <date>: <coach> is fixed at <school> but is off."`, `"<DAY> <date>: <coach> is fixed at <school> but is at <other school>."`, `"<DAY> <date>: <school> has <n> coaches, more than the max of <max>."`
- `roster_rules` has RLS on and no policies; only the function (service role) touches it.
- Shared database: applying SQL, deploying the function and pushing each need Matin's OK first. Never print `.env.local`.

## Review Focus

- A fixed coach whose school has `noLesson` that day (holiday or marked) must stay free for other schools, not be placed or warned about. Test in Task 3.
- A school with more hand-placed coaches than the max must keep them (Auto-Generate never removes hand placements) and show the max warning. Test in Task 3.
- Two fixed-coach rules for the same coach on the same day (two schools) — the first school by name wins, the second gets the "is at" warning. Test in Task 3.
- A rule pointing at an inactive coach or inactive school is ignored by Auto-Generate and gives no warning. Test in Task 3.
- `PATCH /rules/:id` with `value: 0` or `"3"` (string) must be refused with 400, not stored. Test in Task 1 (`validateRule`).

---

### Task 1: `validateRule` in logic.js

**Files:**
- Modify: `supabase/functions/roster/logic.js` (after `validateCoachFields`)
- Test: `supabase/functions/roster/logic.test.js` (append)

**Interfaces:**
- Produces: `RULE_KINDS = ['fixed_coach', 'max_coaches', 'students_per_coach']`; `validateRule(rule, { coachIds: Set<number>, schoolIds: Set<number>, rules: Rule[] }) -> string | null` where `Rule = { id?, kind, coach_id?, school_id?, value?, active?, note? }` and `rules` are the existing rows (for the duplicate check; a row with the same `id` as `rule` is skipped).

- [ ] **Step 1: Write the failing tests** (append to `logic.test.js`)

```js
const ids = { coachIds: new Set([11]), schoolIds: new Set([5]), rules: [{ id: 1, kind: 'fixed_coach', coach_id: 11, school_id: 5 }] }
assert.equal(L.validateRule({ kind: 'students_per_coach', value: 3 }, ids), null)
assert.equal(L.validateRule({ kind: 'max_coaches', value: 4 }, ids), null)
assert.match(L.validateRule({ kind: 'nope' }, ids), /kind/i)
assert.match(L.validateRule({ kind: 'max_coaches', value: 0 }, ids), /1.*20/)
assert.match(L.validateRule({ kind: 'max_coaches', value: '3' }, ids), /1.*20/)
assert.match(L.validateRule({ kind: 'max_coaches', value: 2.5 }, ids), /1.*20/)
assert.match(L.validateRule({ kind: 'fixed_coach', coach_id: 99, school_id: 5 }, ids), /coach/i)
assert.match(L.validateRule({ kind: 'fixed_coach', coach_id: 11, school_id: 99 }, ids), /school/i)
assert.match(L.validateRule({ kind: 'fixed_coach', coach_id: 11, school_id: 5 }, ids), /already/i)
assert.equal(L.validateRule({ id: 1, kind: 'fixed_coach', coach_id: 11, school_id: 5 }, ids), null) // editing itself
```

- [ ] **Step 2: Run, expect FAIL** — `npm test` → `L.validateRule is not a function`.
- [ ] **Step 3: Implement `validateRule`** with messages: `'Unknown rule kind.'`, `'Value must be a whole number from 1 to 20.'`, `'Unknown coach.'`, `'Unknown school.'`, `'That coach is already fixed at that school.'`
- [ ] **Step 4: Run, expect PASS** — `npm test` → ends with `logic ok`.
- [ ] **Step 5: Commit** — `git add supabase/functions/roster/logic.js supabase/functions/roster/logic.test.js && git commit -m "Rules: validateRule"`

### Task 2: `roster_rules` table and function routes

**Files:**
- Create: `sql/07_roster_rules.sql`
- Modify: `supabase/functions/roster/index.ts` (imports; `GET /`; new `/rules` routes before the `PATCH coaches|schools|bases` route; CORS already allows DELETE)

**Interfaces:**
- Consumes: `validateRule`, `RULE_KINDS` (Task 1).
- Produces: `GET /` field `rules: Rule[]` (ordered by `id`); `POST /rules` body `{ kind, coach_id?, school_id?, value?, note? }` → `201 { id }`; `PATCH /rules/:id` body any of `value, active, note, coach_id, school_id` → `204`, `404 'No such rule.'`; `DELETE /rules/:id` → `204`.

- [ ] **Step 1: Write `sql/07_roster_rules.sql`** — header comment in the style of `05_coach_can_lead.sql` ("07: … Safe to run twice."); `create table if not exists roster_rules (...)` with the columns from spec §3 (`coach_id`/`school_id` `references … on delete cascade`, `value int`, `active boolean not null default true`, `note text`, `created_at timestamptz not null default now()`); `alter table roster_rules enable row level security;`; starting rows inserted only when the table is empty: `students_per_coach` 3, `max_coaches` 4, `fixed_coach` with `coach_id = (select id from coaches where name = 'Kathleen')`, `school_id = (select id from schools where name = 'MBR East Coast')`.
- [ ] **Step 2: Add the routes in `index.ts`.** `POST`/`PATCH` read the existing rules, coach ids and school ids, merge the PATCH body over the stored row (`pickFields(body, ['value','active','note','coach_id','school_id'])`), run `validateRule`, then insert/update. `active` must be boolean (`'Active must be true or false.'`). `GET /` adds `db.from('roster_rules').select('id,kind,coach_id,school_id,value,active,note').order('id')` to its `Promise.all` and returns `rules`.
- [ ] **Step 3: Syntax-check** — `npx --yes esbuild@0.24.0 supabase/functions/roster/index.ts --log-level=warning > /dev/null` → no output; `npm test` → still passes.
- [ ] **Step 4: Commit** — `git add sql/07_roster_rules.sql supabase/functions/roster/index.ts && git commit -m "Rules: table and roster function routes"`

(Applying the SQL and deploying are in Task 6, after Matin's OK.)

### Task 3: Auto-Generate follows the rules

**Files:**
- Modify: `src/lib/roster.js` (`autoFill`, its header comment; new `ruleSettings`, `ruleWarnings`)
- Test: `src/lib/roster.test.js`

**Interfaces:**
- Consumes: `Rule` shape (Task 1).
- Produces: `ruleSettings(rules = []) -> { ratio: number, max: number, fixed: { coach_id, school_id }[] }` (active rows only; defaults 3 and 4); `autoFill(week, coaches, travel = {}, rules = [])`; `ruleWarnings(week, coaches, rules = []) -> string[]`.

- [ ] **Step 1: Write the failing tests.** Replace the "everyone free that day is placed / nobody left at WCP" assertion (test at line ~226) with the new behaviour, and add (use the mock fixture; build rules inline):
  - `ruleSettings([])` → `{ ratio: 3, max: 4, fixed: [] }`; inactive rows ignored.
  - fixed coach placed first: clear Monday, rule coach X → second Monday school; X ends up there even when another school is nearer for X.
  - fixed coach whose school is `noLesson` that day stays free and gets no warning.
  - never more than `max`: set a school's slots to 30 students; it gets exactly `max` coaches.
  - 8 students → 3 coaches (one school alone on a day, plenty of free coaches).
  - busiest first when short: two schools 12 and 3 students, only 2 free coaches → the 12-student school gets both.
  - leftovers stay unplaced: more free interns than targets → `baseCoaches(w, day, 'WCP', coaches)` is not empty.
  - fixed and hand-placed coaches are never swapped (set travel so a swap would shorten trips; they stay).
  - hand-placed coaches over the max are kept, and `ruleWarnings` reports `"has 5 coaches, more than the max of 4."`.
  - fixed coach off → warning `"is fixed at … but is off."`; fixed coach hand-placed elsewhere → `"but is at …"`; two fixed schools on one day → first by name wins, warning for the second.
  - rules for an inactive coach or school are ignored, no warning.
  - existing tests (part-timer first, nearest coach, swap, Lead Coach per school, weekend split) still pass; adjust only students/targets they relied on, keep their intent.
- [ ] **Step 2: Run, expect FAIL** — `npm test` → `R.ruleSettings is not a function`.
- [ ] **Step 3: Implement.** Reorder the weekday part of `autoFill` to spec §5 steps 1–8: keep valid placements; place fixed coaches (rules sorted by school name); `target(b) = Math.min(max, Math.ceil(mostStudents(b) / ratio))`; Lead Coach coverage busiest-first among schools under target; fill loop picks the school under target with the highest `mostStudents(b) / countedCoaches(b)` (Infinity when 0) and gives it `placeNearest([that school])`; remove the old 1-per-6 / 1-per-3 / busiest-leftover steps; swap step skips fixed coaches (they are not added to `placed`). Weekend code untouched. `ruleWarnings` checks weekday lesson blocks only (`requiredCoaches(b) > 0`).
- [ ] **Step 4: Run, expect PASS** — `npm test` → all suites `passed`, `logic ok`.
- [ ] **Step 5: Commit** — `git add src/lib/roster.js src/lib/roster.test.js && git commit -m "Auto-Generate: fixed coaches, 1 per 3, max 4, busiest first, rest at WCP"`

### Task 4: Page plumbing (api, context, warnings)

**Files:**
- Modify: `src/lib/api.js`, `src/context/RosterContext.jsx`, `src/components/HeaderControls.jsx`

**Interfaces:**
- Consumes: routes (Task 2), `autoFill`/`ruleWarnings` (Task 3).
- Produces: `api.createRule(rule) -> { id }`, `api.updateRule(id, patch)`, `api.deleteRule(id)`; `api.generateRoster(week, coaches, travel, rules)`; context values `rules` (array) and `addRule(rule) / updateRule(id, patch) / removeRule(id)`, each returning a promise of `true | false` through `run(...)`; on failure the previous `rules` are put back and the error is shown via `say(..., true)`.

- [ ] **Step 1:** api functions call `request` directly (rules do not go through `saveDraft` or `baseline`). `generateRoster` passes `rules` to `autoFill`.
- [ ] **Step 2:** context: `rules: roster.rules ?? []`; `autoGenerate` passes `roster.rules ?? []`; the three actions update `roster.rules` optimistically (add uses the returned `id`).
- [ ] **Step 3:** HeaderControls `quota` also spreads `ruleWarnings(week, Object.values(coachById), rules)`.
- [ ] **Step 4: Check** — `npm test` and `npm run build` pass.
- [ ] **Step 5: Commit** — `git commit -am "Rules: api, context and warnings"`

### Task 5: Rules tab

**Files:**
- Create: `src/components/RulesTab.jsx`
- Modify: `src/components/TopNav.jsx` (add `['rules', 'Rules', <icon>]` after Venues; add a small `Rules` icon — a sliders/list-check shape — to `coachIcons.jsx`), `src/components/RosterDashboard.jsx` (render `<RulesTab />` for `tab === 'rules'`)

**Interfaces:**
- Consumes: context `rules`, `addRule`, `updateRule`, `removeRule`, `coaches`, plus schools from the roster (active weekday schools: `class_day` MON–FRI, `active`).

- [ ] **Step 1: Build `RulesTab`** in the Coach Profiles / Venues card style (`mx-auto max-w-6xl space-y-4`, title row with `SaveStatus`, info line):
  - **Numbers** card: two labelled number inputs (min 1, max 20) for `students_per_coach` and `max_coaches`; send `updateRule` on blur / Enter when the value changed; if the row is missing, `addRule` it.
  - **Fixed coaches** card: one row per `fixed_coach` rule — "Coach → School", an on/off toggle (`aria-pressed`, calls `updateRule(id, { active })`), a delete × (`aria-label="Remove rule"`, confirm first); an add row with coach select, school select and an `ActionButton` "Add fixed coach" (disabled until both are picked).
- [ ] **Step 2: Wire the tab** in TopNav and RosterDashboard.
- [ ] **Step 3: Check** — `npm run build` passes; the browser check happens in Task 6 once the function is deployed.
- [ ] **Step 4: Commit** — `git add src/components/RulesTab.jsx src/components/TopNav.jsx src/components/RosterDashboard.jsx src/components/coachIcons.jsx && git commit -m "Rules tab"`

### Task 6: Contract, rollout and live checks

**Files:**
- Modify: `docs/API_CONTRACT.md` (`rules` field, the three routes and their 400s, the new Auto-Generate order and warnings; remove the "place everyone" wording)

- [ ] **Step 1:** Update `API_CONTRACT.md`; commit.
- [ ] **Step 2 (ask Matin first):** apply `sql/07_roster_rules.sql` as migration `roster_07_roster_rules`; confirm the 3 starting rows with `select kind, coach_id, school_id, value from roster_rules`.
- [ ] **Step 3 (ask Matin first):** deploy `roster` with `index.ts`, `logic.js`, `plan.js` (`verify_jwt: false`).
- [ ] **Step 4: Dry run, no save** — in the dev page run `autoFill` on a clone of each real week with live `travelTimes` and `rules`; check: Kathleen at MBR East Coast every Thursday she works, Tanjong Pagar gets 3, no school over 4, some interns unplaced on busy days, `ruleWarnings` empty for an untouched week.
- [ ] **Step 5: Browser check of the Rules tab** — add a throwaway fixed-coach rule, toggle it, change a number and set it back, delete the throwaway; confirm each change in `roster_rules` with SQL.
- [ ] **Step 6:** Push `backend` and fast-forward `main` only when Matin says so.
