# Travel Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store OneMap public-transport minutes for every coach × preschool, show them in the "+" coach list and let Auto-Generate prefer the nearest free coach on weekday lessons.

**Architecture:** The `roster` Edge Function gets a refresh route that geocodes stations and postcodes, asks OneMap routing for each missing pair and stores results in a new `travel_times` table; `GET /` returns the current minutes. Pure helpers live in `supabase/functions/roster/logic.js` (tested in Node); the site reads `roster.travelTimes`.

**Tech Stack:** React 19 + Vite (existing), Supabase Postgres + Edge Function (Deno), OneMap search / routing / token APIs, Node `node:assert` tests.

**Spec:** `docs/superpowers/specs/2026-11-04-travel-times-design.md`

## Global Constraints

- The browser never calls OneMap; `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` live only in Supabase secrets.
- Trip: home MRT (`coaches.mrt_station`) → preschool postcode (last 6 digits of `schools.address`); public transport (`routeType=pt`, `mode=TRANSIT`), Tuesday 14:00, `maxWalkDistance=1000`, fastest of up to 3 itineraries.
- A stored row is current only when `from_station` = trimmed `mrt_station` and `to_postcode` = the school's postcode.
- Weekday lessons only; weekends, programmes and OTHERS unchanged.
- Refresh batches default to `limit: 40`.
- Token refused → `502` `OneMap didn't accept the login — check ONEMAP_EMAIL / ONEMAP_PASSWORD in Supabase.`; nothing saved.
- No new npm dependencies; no semicolons, 2-space indent, short why-comments.
- Shared production DB and live function: SQL apply, deploy, push and merge each need Matin's OK. **Do not push** until Matin says.

## Review Focus

1. A coach's MRT typed as "Sengkang" (no "MRT") must still be found → Task 2 test `stationQuery adds MRT once`.
2. An address with a unit number after the postcode or trailing spaces → Task 2 test `postcodeOf takes the last 6-digit group`.
3. Changing a coach's MRT makes their old times disappear from `travelTimes` and come back as pending → Task 2 test `stale rows are pending, not current`.
4. A school with no postcode, a coach with no MRT, or an inactive coach is never sent to OneMap → Task 2 test `pendingPairs` (fixtures `ts[1]`, `tc[1]`, `tc[2]`).
5. Auto-Generate with no travel times at all behaves exactly as before → Task 4 test `no travel map keeps the old order`.

---

### Task 1: `travel_times` table

**Files:** Create `sql/04_travel_times.sql`

- [ ] **Step 1:** Write the file with the DDL from spec §4 verbatim, preceded by an informational `select to_regclass('public.travel_times') as travel_times_already_exists;` (same convention as `sql/02`/`03`).
- [ ] **Step 2:** Commit: `git add sql/04_travel_times.sql && git commit -m "Add travel_times table"` (controller applies it via MCP after Matin's OK).

---

### Task 2: Pure travel helpers

**Files:** Modify `supabase/functions/roster/logic.js`; Test `supabase/functions/roster/logic.test.js`

**Interfaces — Produces:**
- `postcodeOf(address: string|null) -> string|null` — last standalone 6-digit group.
- `stationQuery(mrt: string) -> string` — trimmed; appends `' MRT'` unless the text already contains "mrt" (any case).
- `pendingPairs(coaches, schools, rows) -> [{ coach_id, school_id, from_station, to_postcode }]` — active coaches with a non-blank station × active schools with a postcode, minus pairs whose row is current.
- `routeMinutes(reply) -> number|null` — `Math.round(min(plan.itineraries[].duration) / 60)`, `null` when there are none.
- `travelMap(rows, coaches, schools) -> { travelTimes: { [coachId]: { [schoolId]: minutes|null } }, unrecognisedStations: number[] }` — current rows only; a coach is unrecognised when any current row has `status === 'station-not-found'`.

- [ ] **Step 1: Failing tests** (append; fixtures are trimmed real reply shapes):
```js
assert.equal(L.postcodeOf('90 Jurong East Street 13, Singapore 609648'), '609648')
assert.equal(L.postcodeOf('12 Hoy Fatt Road, Singapore 159506 #02-01 '), '159506')
assert.equal(L.postcodeOf(''), null)
assert.equal(L.stationQuery(' Sengkang '), 'Sengkang MRT')
assert.equal(L.stationQuery('Bukit Batok MRT'), 'Bukit Batok MRT')
const tc = [{ id: 1, active: true, mrt_station: 'Sengkang MRT' }, { id: 2, active: true, mrt_station: null }, { id: 3, active: false, mrt_station: 'Yishun MRT' }]
const ts = [{ id: 10, active: true, address: '5 Tanjong Pagar Plaza, Singapore 081005' }, { id: 11, active: true, address: null }]
assert.deepEqual(L.pendingPairs(tc, ts, []), [{ coach_id: 1, school_id: 10, from_station: 'Sengkang MRT', to_postcode: '081005' }])
const row = { coach_id: 1, school_id: 10, from_station: 'Sengkang MRT', to_postcode: '081005', minutes: 38, status: 'ok' }
assert.deepEqual(L.pendingPairs(tc, ts, [row]), [])
// stale rows are pending, not current
const moved = [{ ...tc[0], mrt_station: 'Punggol MRT' }]
assert.equal(L.pendingPairs(moved, ts, [row]).length, 1)
assert.deepEqual(L.travelMap([row], moved, ts).travelTimes, {})
assert.deepEqual(L.travelMap([row], tc, ts), { travelTimes: { 1: { 10: 38 } }, unrecognisedStations: [] })
assert.deepEqual(L.travelMap([{ ...row, minutes: null, status: 'station-not-found' }], tc, ts).unrecognisedStations, [1])
assert.equal(L.routeMinutes({ plan: { itineraries: [{ duration: 2400 }, { duration: 2280 }] } }), 38)
assert.equal(L.routeMinutes({ plan: { itineraries: [] } }), null)
assert.equal(L.routeMinutes({}), null)
```
- [ ] **Step 2:** `node supabase/functions/roster/logic.test.js` → FAIL (`L.postcodeOf is not a function`).
- [ ] **Step 3:** Implement the five helpers in `logic.js`. `postcodeOf` uses `/(?:^|\D)(\d{6})(?!\d)/g` and takes the last match.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `"Travel time helpers"`.

---

### Task 3: Function — OneMap client, refresh route, times in `GET /`

**Files:** Modify `supabase/functions/roster/index.ts`, `supabase/functions/roster/README.md`

**Interfaces — Consumes:** Task 2 helpers. **Produces:**
- `GET /` adds `travelTimes` and `unrecognisedStations` (from `travelMap` over all `travel_times` rows).
- `POST /travel-times/refresh` body `{ limit?: number }` (1–100, default 40) → `200 { done, remaining, total }`.

- [ ] **Step 1: OneMap client in `index.ts`.** `onemapToken()` POSTs `{ email, password }` to `https://www.onemap.gov.sg/api/auth/post/getToken`, caches `access_token` in module memory until `expiry_timestamp` (seconds) minus 5 minutes; missing secret or no `access_token` → throw `OneMapLoginError`. `onemapSearch(q, token)` → `{ lat, lng } | null` from `results[0].LATITUDE/LONGITUDE` (`returnGeom=Y&getAddrDetails=N&pageNum=1`). `onemapRoute(from, to, token)` → reply JSON; query `routeType=pt&mode=TRANSIT&date=<next Tuesday MM-DD-YYYY>&time=14:00:00&maxWalkDistance=1000&numItineraries=3`, header `Authorization: <token>`. A `401` from search or routing → `OneMapLoginError`.
- [ ] **Step 2: Refresh route.** Load active coaches, active schools and all `travel_times`; `pending = pendingPairs(...)`; take the first `limit`. Geocode each distinct `stationQuery(from_station)` and `to_postcode` once (Map cache). For each pair, 4 at a time: station not found → `status 'station-not-found'`, minutes null; school postcode not found or no itinerary → `'no-route'`, null; else `'ok'`, `routeMinutes`. Upsert each row as soon as it's known (`onConflict: 'coach_id,school_id'`, `updated_at` now). Return `{ done, remaining: pending.length - done, total }` where `total` = pending pairs + current rows. `OneMapLoginError` → the 502 message from Global Constraints. Any other OneMap failure → `502 { error: 'OneMap is not responding: <reason>. Times worked out so far are kept.' }`.
- [ ] **Step 3: `GET /`** adds the two fields; add `travel_times` to its existing `Promise.all`.
- [ ] **Step 4: README:** add the two secrets and the refresh route.
- [ ] **Step 5:** `npm test` still passes (no Deno here; reviewer reads the TS).
- [ ] **Step 6:** Commit `"OneMap travel time refresh in the roster function"`. Controller deploys after Matin's OK and after Matin has set the secrets; live check: `POST /travel-times/refresh {"limit":5}` returns `done: 5`, then `GET /` shows Matin's times.

---

### Task 4: Auto-Generate prefers the nearest free coach

**Files:** Modify `src/lib/roster.js`, `src/lib/api.js`, `src/context/RosterContext.jsx`; Test `src/lib/roster.test.js`

**Interfaces — Produces:** `autoFill(week, coaches, travel = {})` where `travel` is `travelTimes`; `api.generateRoster(week, coaches, travel)`.

- [ ] **Step 1: Failing tests:**
```js
// nearest free coach wins a weekday school; unknown times go last
w = structuredClone(weeks[0])
const dover2 = w.days[0].blocks[1]
dover2.coaches = []
const [far, near] = R.baseCoaches(w, 'mon', 'WCP', coaches).map((c) => c.id) // two interns free on Monday
R.autoFill(w, coaches, { [near]: { [dover2.schoolId]: 10 }, [far]: { [dover2.schoolId]: 50 } })
assert.equal(dover2.coaches[0].id, near, 'nearest coach placed first')
// no travel map keeps the old order
const a = structuredClone(weeks[0]); const b = structuredClone(weeks[0])
R.autoFill(a, coaches); R.autoFill(b, coaches, {})
assert.deepEqual(R.diffAssignments(a, b), { added: [], removed: [], newLeads: [] })
```
(If `pickLead` randomness makes the second assert flaky, compare placements ignoring roles.)
- [ ] **Step 2:** `npm test` → FAIL on "nearest coach placed first".
- [ ] **Step 3:** In `autoFill`'s weekday top-up loop, for a lesson block pick from `free` the id with the smallest `travel[id]?.[block.schoolId]` (missing or null = Infinity; ties keep current `free` order) instead of `free.shift()`. Weekend loop untouched. `api.generateRoster` forwards `travel`; context calls `api.generateRoster(week, coaches, roster.travelTimes ?? {})`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `"Auto-Generate prefers the nearest free coach"`.

---

### Task 5: Times on screen and the refresh button

**Files:** Modify `src/components/CoachSwapModal.jsx`, `src/components/CoachProfiles.jsx`, `src/lib/api.js`, `src/context/RosterContext.jsx`

**Interfaces — Produces:** `api.refreshTravelTimes(limit = 40) -> { done, remaining, total }`; context `travelTimes`, `unrecognisedStations`, `refreshTravelTimes()`.

- [ ] **Step 1: Picker.** For `block.kind === 'lesson'`, after the existing rank sort, sort by `travelTimes[c.id]?.[block.schoolId]` (unknown last, stable) and show `"{mrt_station} · {n} min"` or `"—"` under each name. Other blocks unchanged.
- [ ] **Step 2: Refresh.** `api.refreshTravelTimes` POSTs `/travel-times/refresh`. Context `refreshTravelTimes(onProgress)` loops until `remaining === 0` (stop on error or a call that returns `done: 0`), calling `onProgress(total - remaining, total)`, then reloads `travelTimes`/`unrecognisedStations` with `api.loadRoster()` fields only (keep the in-memory weeks and edits). Returns `true` / `false` for `ActionButton`.
- [ ] **Step 3: Coach Profiles.** `ActionButton` by the title: label `Work out travel times`, working text `Working out travel times… {done} / {total}` (live), done `{total} travel times up to date`. Cards of coaches in `unrecognisedStations` show `MRT not recognised` (orange) under the station.
- [ ] **Step 4:** `npm test && npm run build` pass; browser: picker on a weekday school renders (times "—" until refresh runs).
- [ ] **Step 5:** Commit `"Show travel times and add the refresh button"`.

---

### Task 6: Docs and live check

**Files:** Modify `docs/API_CONTRACT.md`

- [ ] **Step 1:** Contract: `travelTimes` / `unrecognisedStations` in the Roster shape, the refresh endpoint and its errors, the Auto-Generate nearest rule, the new secrets.
- [ ] **Step 2 (after Tasks 1 and 3 are live and secrets set):** press the button until "up to date"; check Sengkang → Punggol and Toa Payoh < Sengkang → Tanjong Pagar; compare two times with Google Maps; check the "+" list order on one school.
- [ ] **Step 3:** Commit `"Document travel times"`. **Do not push** — ask Matin.
