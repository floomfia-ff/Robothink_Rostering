# Roster API contract (frontend ⇄ backend ⇄ engine)

The admin UI talks to the server **only** through `src/lib/api.js`, which calls the Supabase Edge
Function `roster` (`supabase/functions/roster/`). Every request sends the header `x-roster-code`.
Names below are the database's own column names, so everyone sees one set of names.

If you need a different shape, tell the UI owner and update this file in the same PR.

---

## 1. Data the UI uses

### Roster (everything)

```json
{ "coaches": [Coach], "schools": [School], "bases": [Base], "weeks": [Week],
  "planError": null, "unmatchedSchools": [],
  "travelTimes": { "7": { "3": 28 } }, "unrecognisedStations": [] }
```

| Field | Notes |
|---|---|
| `planError` | Text when the lesson plan sheet could not be read, otherwise `null`. Everything else still loads. |
| `unmatchedSchools` | Names of active schools in the database that are not on the sheet (check the spelling). |
| `weeks` | Every saved week, plus the current week (Singapore time) if it is not saved yet. |
| `travelTimes` | `{ coachId: { schoolId: minutes } }` by public transport from the coach's MRT to the school, OneMap, a Tuesday at 2pm. Only times still matching the coach's MRT and the school's postcode; `null` = no route. |
| `unrecognisedStations` | Coach ids whose MRT OneMap could not find (fix the spelling, then work the times out again). |

### Coach

```json
{ "id": 12, "name": "Ameer", "active": true, "employment_type": "intern", "mrt_station": "Toa Payoh", "can_lead": true }
```

| Field | Type | Notes |
|---|---|---|
| `id` | number | Stable. Used everywhere else to point at the coach. |
| `name` | string | Read-only here (edited in the feedback site). |
| `active` | boolean | Inactive coaches are still returned so past weeks show them. The UI stops them being placed on new days; the server only checks that the id exists. |
| `employment_type` | `"intern"` \| `"part-timer"` | Editable. Interns get one weekday off (Tue or Wed) and one weekend day off. New coaches default to `part-timer`. |
| `can_lead` | boolean | Editable ("Lead Coach" toggle in Coach Profiles). Experienced coaches Auto-Generate makes Lead. Defaults to `false`. |
| `mrt_station` | string \| null | Editable. Nearest MRT station (free text). |

### School (a weekday venue)

```json
{ "id": 3, "name": "MBR Tanjong Pagar", "brand": "MBR", "class_day": "MON", "active": true, "address": "1 Example Road, Singapore 123456" }
```

`address` is editable and must end in a 6-digit postal code, or be blank to clear it (stored as empty, returned as `null`). Everything else is read-only here.
`class_day` (`MON`–`FRI`) decides which weekday the school's lesson appears on.

### Base (weekend location)

```json
{ "id": 1, "code": "WCP", "name": "RoboThink West Coast Plaza", "address": "154 West Coast Road, Singapore 127371" }
```

`code` (`WCP` / `DV`) matches `base` on weekend programmes. Only `address` is editable.

### Week

```json
{
  "id": "2026-10-19",
  "label": "19-Oct to 25-Oct",
  "status": "draft",
  "changedSincePublish": false,
  "days": [Day × 7, mon → sun],
  "availability": { "12": ["available", "off", "available", "available", "available", "available", "off"] }
}
```

| Field | Notes |
|---|---|
| `id` | Monday's date, `YYYY-MM-DD`. |
| `status` | `"draft"` or `"published"`. Only the publish endpoint changes it. |
| `changedSincePublish` | `true` when a published week was saved again and not republished. |
| `availability[coachId]` | Keyed by the coach id **as a string**. 7 values, Mon → Sun: `"available"`, `"off"` (requested off), `"unavailable"` (X). |

A week that has never been saved is a draft with no coaches. Its weekend programmes (without coaches)
and availability are copied from the most recent earlier saved week; with none, each weekend day has
only the OTHERS row and every coach is `available`.

### Day

```json
{ "key": "mon", "label": "MON", "date": "19-Oct", "blocks": [Block] }
```

### Block (one venue / programme on one day)

Weekday lesson (built from `schools.class_day` and the lesson plan sheet):

```json
{
  "id": "2026-10-19-mon-school-3",
  "kind": "lesson",
  "schoolId": 3,
  "name": "MBR Tanjong Pagar",
  "noLesson": false,
  "slots": [
    { "time": "15:30 - 16:30", "students": 8, "builds": [ { "build": "L1-2A Example", "students": 5 }, { "build": "L1-3B Example", "students": 3 } ] }
  ],
  "coaches": [ { "id": 12, "role": "lead" }, { "id": 7, "role": "coach" } ]
}
```

Weekend programme (entered by hand, at a base):

```json
{
  "id": "2026-10-24-sat-wcp-robotics-regular",
  "kind": "program",
  "name": "WCP Robotics (Regular)",
  "base": "WCP",
  "slots": [ { "time": "09:00 - 16:00", "students": 8 } ],
  "coaches": [ { "id": 4, "role": "coach" } ]
}
```

Weekend OTHERS row: `{ "id": "...-sat-others", "kind": "other", "name": "OTHERS", "slots": [], "coaches": [...] }`

| Field | Notes |
|---|---|
| `kind` | `"lesson"` (weekday school), `"program"` (weekend), `"other"` (OTHERS row). |
| `schoolId` | Lessons only. Points at `schools[].id`. |
| `slots[].time` | `"HH:MM - HH:MM"`, 24-hour, start before end. Sheet text like `1600 - 1700` is converted. |
| `slots[].students` | Number. Lessons: counted from the sheet. Programmes: not used — weekends take coach names only. |
| `slots[].builds` | Lessons only: `{ build, students }`, most students first. A double ("A & B") counts the child once in `students`. |
| `noLesson` | Lesson cancelled that day; it has no coaches. Set by the admin, or by the server when the sheet has no children that date and the saved block has no coaches. |
| `holiday` | `true` when `noLesson` came from the sheet. Never saved. A sheet holiday shows as No lesson unless the saved block has coaches (the admin turned No lesson off and assigned coaches). Turning No lesson on is saved. |
| `inactive` | `true` on a lesson whose school was deactivated but that the published week already had. |
| `coaches[].id` | Number, matches `coaches[].id`. A coach deleted from the database is dropped from saved weeks on load. |
| `coaches[].role` | `"lead"`, `"coach"` or `"shadow"`. |

Weekday lesson names, slots and counts are rebuilt from the database and sheet on every load, so they
are never saved. Children's names never leave the server: the sheet is reduced to counts and build names.

**Stored shape** (`roster_weeks.data`, one row per week, for reference):

```json
{
  "availability": { "12": ["available", "off", "available", "available", "available", "available", "off"] },
  "days": [
    { "key": "mon", "blocks": [ { "kind": "lesson", "schoolId": 3, "noLesson": false, "coaches": [ { "id": 12, "role": "lead" } ] } ] },
    { "key": "sat", "blocks": [ { "kind": "program", "id": "...", "name": "...", "base": "WCP", "slots": [], "coaches": [] },
                               { "kind": "other", "id": "...", "name": "OTHERS", "slots": [], "coaches": [] } ] }
  ]
}
```

A lesson stores only `schoolId`, `noLesson` and `coaches`. Weekend programme and OTHERS blocks are stored whole.

**Not stored, worked out by the UI:** weekday WCP (available interns not at a venue), weekend WCP / DV rows
(all coaches in that base's programmes), totals, and status colours.

Inactive schools do not appear on draft weeks. A published week that already had the school keeps it.

---

## 2. Rules the UI checks (the engine must follow the same ones)

These live in `src/lib/roster.js`, with tests in `src/lib/roster.test.js` (`npm test`).

| Rule | Value |
|---|---|
| Coach count | Follows the **Rules tab** (`roster_rules`). Auto-Generate, on weekdays: 1) fixed coaches go to their school (first school by name wins; not past the max); 2) each school's target is `min(max_coaches, ceil(largest slot's students ÷ students_per_coach))` (defaults 4 and 3; shadows don't count); 3) a Lead Coach at every school without one, then up to each target, the school with the most students per coach picking next and taking its nearest free coach (part-timers first, a second Lead Coach last); 4) two non-Lead, non-fixed coaches it placed trade schools when that shortens their trips; 5) **anyone still free stays at WCP**. Hand placements are kept even past the max. Spare weekend coaches are spread over running weekend programmes. |
| Leads | Exactly **one** Lead per weekday lesson, picked from `can_lead` coaches when the school has one. A Lead without `can_lead` shows a warning, not a block. **No** Leads on weekend programmes. |
| One place per day | A coach is in at most one block per day. |
| Intern days off | Exactly 2 days off: **one weekday, which must be Tuesday or Wednesday**, and **one weekend day**. Weekday interns not at a venue count as working at WCP. **Auto-Generate sets these days off** for any intern who has none (Tue/Wed and Sat/Sun each split evenly, keeping days they're already placed on). Manual edits that break it show a warning, not a block. Changing an intern's day by hand also changes it in every later week already created; new weeks copy the week before. Clear coaches keeps days off. |
| Availability | Never place a coach on a day marked `off` or `unavailable`. |
| Part-timers | Shown as `unavailable` (X) on **every day they aren't placed**, on every week, saved or not. Admins make a part-timer available and place them by hand; days without a placement go back to X on the next load. Interns carry their availability over from the previous week. |
| Weekend split | Auto-Generate gives each coach free on both weekend days exactly one of them, filling the quieter day first, so Saturday and Sunday split evenly. |

Status badges: yellow **No lead** → green **OK**. Grey means no lesson, no class or no students.

A new week with no earlier saved week starts each weekend day with WCP Robotics (Regular), WCP Coding,
DV Robotics (Regular), WCP Robotics (Dream), DV Robotics (Dream) and OTHERS, all 9am to 4pm with no coaches.
Later weeks copy the previous saved week's weekend programmes.

Screen behaviour that follows from live data: weekday slots are read-only; weekday blocks cannot be
added or removed (only "No lesson" toggles); coach names, school names and base names are read-only.

---

## 3. Endpoints

All under the function URL (`VITE_ROSTER_API_URL`). Send `x-roster-code` on every call, and
`Content-Type: application/json` when there is a body.

| `api.js` function | Request | Sends | Gets back |
|---|---|---|---|
| `loadRoster()` | `GET /` | — | Roster |
| `loadWeek(id)` | `GET /weeks/:id` | — | One Week, built fresh (or the saved one merged with fresh slots). Used for "New week". |
| `deleteWeek(id)` | `DELETE /weeks/:id` | — | `204`. Hides the saved week (`deleted_at` set; fine if it was never saved). "Delete week" button, after a confirm. |
| `restoreWeek(id)` | `POST /weeks/:id/restore`, then `GET /weeks/:id` | — | The week as saved. "Restore a deleted week" menu, shown when `deletedWeeks` is not empty. |
| `saveDraft(roster)` | `PUT /weeks/:id` for each changed week, then `PATCH /coaches/:id`, `PATCH /schools/:id`, `PATCH /bases/:id` for each changed one | see below | `204` each |
| `generateRoster(week, coaches, travel, rules)` | none yet | — | Runs `autoFill()` in the browser with `travelTimes` and `rules` (see Coach count). |
| `createRule(rule)` / `updateRule(id, patch)` / `deleteRule(id)` | `POST /rules` / `PATCH /rules/:id` / `DELETE /rules/:id` | see below | Rules tab; sent straight away, not through `saveDraft`. |
| `refreshTravelTimes(limit = 40)` | `POST /travel-times/refresh` | `{ "limit": 40 }` | `{ done, remaining, total, travelTimes, unrecognisedStations }`. The "Work out travel times" button calls it until `remaining` is 0 and takes the fresh times from each reply. |

**There is no Save or Publish button.** The site calls `saveDraft` by itself a second after the last edit, and
retries every 10 seconds after a failure. `api.js` compares against what it last loaded or saved and sends only
what changed; an address that is half-typed (not blank, no 6-digit postal code) waits until it is valid.
`POST /weeks/:id/publish` still exists on the server but nothing calls it.

| Request | Body | Notes |
|---|---|---|
| `POST /rules` | `{ "kind": "fixed_coach", "coach_id": 11, "school_id": 5 }` or `{ "kind": "max_coaches", "value": 4 }` | `kind` is `fixed_coach`, `max_coaches` or `students_per_coach`; a fixed coach needs a known coach and school and must not repeat an existing pair; `value` is a whole number 1–20. `201 { id }`. |
| `PATCH /rules/:id` | any of `value`, `active`, `note`, `coach_id`, `school_id` | Checked as the whole rule it would leave; `active` is `true` / `false`. `404` if there is no such rule. |
| `DELETE /rules/:id` | — | `204`. |
| `PATCH /coaches/:id` | `{ "mrt_station": "…", "employment_type": "intern", "can_lead": true }` (any of them) | `employment_type` must be `intern` or `part-timer`; `mrt_station` is text or `null`; `can_lead` is `true` / `false`. |
| `PATCH /schools/:id` | `{ "address": "…" }` | Must end in a 6-digit postal code. Blank or `null` clears it (stored as empty). |
| `PATCH /bases/:id` | `{ "address": "…" }` | Same check. |
| `DELETE /weeks/:id` | — | Hides the saved week (sets `deleted_at`); a week with no row still returns `204`. Deleted weeks are left out of `weeks`, of carry-over and of `GET /weeks/:id`, and listed in `GET /`'s `deletedWeeks: [{ id, label }]`. `GET /` also returns `rules: [{ id, kind, coach_id, school_id, value, active, note }]`. Saving a week with `PUT` un-deletes it. |
| `POST /weeks/:id/restore` | — | Clears `deleted_at`. `404` if there is no row. |
| `PUT /weeks/:id` | The whole Week | `id` in the body must equal the address. Upserts the decisions. Status stays as it was; if the week is published, `changedSincePublish` becomes `true`. |
| `POST /weeks/:id/publish` | — | The week must already be saved. |
| `POST /travel-times/refresh` | `{ "limit": 1-100 }` (default 40) | Works out missing coach x school times with OneMap and saves each to `travel_times` as soon as it is known. Needs the `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` secrets. |

These edits go straight into the shared `coaches` and `schools` rows, so the feedback site shows them on its next load.

### Errors

Non-2xx status with `{ "error": "Readable message for the admin" }`. `api.js` throws `new Error(body.error)`.
The UI shows the message in red next to the page title, keeps the admin's unsaved changes, and retries.

| Status | When |
|---|---|
| `401` | Missing or wrong code: "Roster code not accepted." Nothing is read or saved. |
| `400` | Body is not a JSON object; nothing to update; employment type not `intern` / `part-timer`; MRT station not text; can lead not true / false; rule kind unknown; rule value not a whole number 1–20; unknown coach or school in a rule; that coach already fixed at that school; rule active not true / false; non-blank address without a 6-digit postal code; week id not a Monday; body week id differs from the address; week not 7 days Monday first; "Every day needs blocks, and every block needs coaches."; lesson `schoolId` not a whole number; unknown coach id; role not `lead` / `coach` / `shadow`; availability not 7 values of `available` / `off` / `unavailable`. |
| `404` | "No such coach." / "No such school." / "No such base."; publishing a week that was never saved ("Save the week before publishing it."); any other path. |
| `500` | The function is missing a secret, or the database failed. The message says which. |
| `502` | Travel times only: "OneMap didn't accept the login — check ONEMAP_EMAIL / ONEMAP_PASSWORD in Supabase." (nothing saved), or "OneMap is not responding: … Times worked out so far are kept." |

If the lesson plan sheet cannot be read, that is **not** an error: the response carries `planError`,
lesson blocks have `slots: []`, and saving still works.

---

## 4. Not done yet

- **Travel times, later:** weekends and WCP / DV, measuring interns from WCP, schools by their nearest MRT, and
  matching over all schools for the lowest total travel (Auto-Generate is greedy, one school at a time).
- **Auto-generate engine (Dev 3):** `generateRoster()` still fills the week in the browser with `autoFill()`
  in `src/lib/roster.js`. The planned `POST /weeks/:id/generate` should keep valid assignments, fill only what
  is short, and return the whole week in the shape above. Its tests show the expected behaviour.
- **Notifications on publish, coach mobile view (Dev 4).**
- **Logins:** none, by design. The roster code is compiled into the site's JavaScript, so anyone with the
  site's link can use the roster and edit MRT stations, employment types and addresses. Accepted because
  the link is shared only with the supervisor and developers; if it spreads, change `ROSTER_CODE` and rebuild.
- **Two admins editing the same week:** last save wins.
