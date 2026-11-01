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
  "planError": null, "unmatchedSchools": [] }
```

| Field | Notes |
|---|---|
| `planError` | Text when the lesson plan sheet could not be read, otherwise `null`. Everything else still loads. |
| `unmatchedSchools` | Names of active schools in the database that are not on the sheet (check the spelling). |
| `weeks` | Every saved week, plus the current week (Singapore time) if it is not saved yet. |

### Coach

```json
{ "id": 12, "name": "Ameer", "active": true, "employment_type": "intern", "mrt_station": "Toa Payoh" }
```

| Field | Type | Notes |
|---|---|---|
| `id` | number | Stable. Used everywhere else to point at the coach. |
| `name` | string | Read-only here (edited in the feedback site). |
| `active` | boolean | Inactive coaches are still returned so past weeks show them. They cannot be placed on new days. |
| `employment_type` | `"intern"` \| `"part-timer"` | Editable. Interns have the 4 weekdays + 1 weekend quota. New coaches default to `part-timer`. |
| `mrt_station` | string \| null | Editable. Nearest MRT station (free text). |

### School (a weekday venue)

```json
{ "id": 3, "name": "MBR Tanjong Pagar", "brand": "MBR", "class_day": "MON", "active": true, "address": "1 Example Road, Singapore 123456" }
```

`address` is editable and must end in a 6-digit postal code. Everything else is read-only here.
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
| `slots[].students` | Number. Lessons: counted from the sheet. Programmes: optional (blank = class not set up yet). |
| `slots[].builds` | Lessons only: `{ build, students }`, most students first. A double ("A & B") counts the child once in `students`. |
| `noLesson` | Lesson cancelled that day; it has no coaches. Set by the admin, or by the server when the sheet has no children that date. |
| `holiday` | `true` when `noLesson` came from the sheet. Never saved. The admin toggling "No lesson" clears it and the choice is saved. |
| `inactive` | `true` on a lesson whose school was deactivated but that the published week already had. |
| `coaches[].id` | Number, matches `coaches[].id`. |
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
| Coaches needed | `ceil(largest slot's students ÷ 6)`. Shadows don't count. |
| Leads | Exactly **one** Lead per weekday lesson. **No** Leads on weekend programmes. |
| One place per day | A coach is in at most one block per day. |
| Intern quota | Exactly 4 weekdays + 1 weekend day. Weekday interns not at a venue count as working at WCP. |
| Availability | Never place a coach on a day marked `off` or `unavailable`. |

Status colours: red **Short n** (fewer coaches than needed) → yellow **No lead** → green **OK**.
Grey means no lesson, no class or no students.

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
| `saveDraft(roster)` | `PATCH /coaches/:id`, `PATCH /schools/:id`, `PATCH /bases/:id` for each changed one, then `PUT /weeks/:id` for each changed week | see below | `204` each |
| `publishRoster(roster, weekId)` | `saveDraft`, then `POST /weeks/:id/publish` | — | `204`. Sets `status: "published"`, `changedSincePublish: false`. |
| `generateRoster(week, coaches)` | none yet | — | Runs `autoFill()` in the browser. |

`api.js` compares against what it last loaded or saved, and sends only what changed.

| Request | Body | Notes |
|---|---|---|
| `PATCH /coaches/:id` | `{ "mrt_station": "…", "employment_type": "intern" }` (either or both) | `employment_type` must be `intern` or `part-timer`; `mrt_station` is text or `null`. |
| `PATCH /schools/:id` | `{ "address": "…" }` | Must end in a 6-digit postal code. |
| `PATCH /bases/:id` | `{ "address": "…" }` | Same check. |
| `PUT /weeks/:id` | The whole Week | `id` in the body must equal the address. Upserts the decisions. Status stays as it was; if the week is published, `changedSincePublish` becomes `true`. |
| `POST /weeks/:id/publish` | — | The week must already be saved. |

These edits go straight into the shared `coaches` and `schools` rows, so the feedback site shows them on its next load.

### Errors

Non-2xx status with `{ "error": "Readable message for the admin" }`. `api.js` throws `new Error(body.error)`.
The UI shows the message in red, keeps the admin's unsaved changes, and lets them try again.
A failed publish does **not** mark the week published.

| Status | When |
|---|---|
| `401` | Missing or wrong code: "Roster code not accepted." Nothing is read or saved. |
| `400` | Body is not a JSON object; nothing to update; employment type not `intern` / `part-timer`; MRT station not text; address without a 6-digit postal code; week id not a Monday; body week id differs from the address; week not 7 days Monday first; unknown coach id; role not `lead` / `coach` / `shadow`; availability not 7 values of `available` / `off` / `unavailable`. |
| `404` | "No such coach / school / base."; publishing a week that was never saved ("Save the week before publishing it."); any other path. |
| `500` | The function is missing a secret, or the database failed. The message says which. |

If the lesson plan sheet cannot be read, that is **not** an error: the response carries `planError`,
lesson blocks have `slots: []`, and saving still works.

---

## 4. Not done yet

- **Google Maps travel time (spec #2):** will use the MRT stations and addresses now available.
- **Auto-generate engine (Dev 3):** `generateRoster()` still fills the week in the browser with `autoFill()`
  in `src/lib/roster.js`. The planned `POST /weeks/:id/generate` should keep valid assignments, fill only what
  is short, and return the whole week in the shape above. Its tests show the expected behaviour.
- **Notifications on publish, coach mobile view (Dev 4).**
- **Logins:** none, by design. The roster code is compiled into the site's JavaScript, so anyone with the
  site's link can use the roster and edit MRT stations, employment types and addresses. Accepted because
  the link is shared only with the supervisor and developers; if it spreads, change `ROSTER_CODE` and rebuild.
- **Two admins editing the same week:** last save wins.
