# Roster API contract (frontend ⇄ backend ⇄ engine)

The admin UI (Dev 1) talks to the server **only** through `src/lib/api.js`.
Today those functions save to the browser (localStorage). To connect the real backend,
replace each function body with a `fetch()` call to the endpoint below. Keep the same
inputs and outputs, and no screen has to change.

Anything here can still change. If you need a different shape, tell Dev 1 and update this file in the same PR.

---

## 1. Data the UI uses

### Roster (everything)

```json
{ "coaches": [Coach], "venues": [Venue], "weeks": [Week] }
```

### Coach

```json
{ "id": "ameer", "name": "Ameer", "type": "intern", "mrt": "Toa Payoh" }
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable and unique. Used everywhere else to point at the coach. |
| `name` | string | |
| `type` | `"intern"` \| `"part-timer"` | Interns have the 4 weekdays + 1 weekend quota. |
| `mrt` | string | Nearest MRT station (free text). Dev 4 can turn it into a location. |

### Venue

```json
{ "name": "MBR Tanjong Pagar", "address": "", "postalCode": "" }
```

`name` is the key for now. It matches the block `name` on weekdays and the `base` (`WCP` / `DV`) on weekends.
`postalCode` is 6 digits (Singapore). **Backend:** give venues a real `id` and the UI will switch to it.

### Week

```json
{
  "id": "2026-10-19",
  "label": "19-Oct to 25-Oct",
  "status": "draft",
  "changedSincePublish": false,
  "days": [Day × 7, mon → sun],
  "availability": { "ameer": ["available", "off", "available", "available", "available", "available", "off"] }
}
```

| Field | Notes |
|---|---|
| `id` | Monday's date, `YYYY-MM-DD`. |
| `status` | `"draft"` or `"published"`. |
| `changedSincePublish` | `true` when a published week was edited and not republished. |
| `availability[coachId]` | 7 values, Mon → Sun: `"available"`, `"off"` (requested off), `"unavailable"` (X). |

### Day

```json
{ "key": "mon", "label": "MON", "date": "19-Oct", "blocks": [Block] }
```

### Block (one venue / programme on one day)

Weekday venue lesson:

```json
{
  "id": "2026-10-19-mon-mbr-tanjong-pagar",
  "name": "MBR Tanjong Pagar",
  "kind": "lesson",
  "noLesson": false,
  "slots": [ { "time": "15:30 - 16:30", "students": 8 }, { "time": "16:30 - 17:30", "students": 6 } ],
  "coaches": [ { "id": "ameer", "role": "lead" }, { "id": "matin", "role": "coach" } ]
}
```

Weekend programme (9am–4pm, at a base):

```json
{
  "id": "2026-10-19-sat-wcp-robotics-regular",
  "name": "WCP Robotics (Regular)",
  "kind": "program",
  "base": "WCP",
  "slots": [ { "time": "09:00 - 16:00", "students": 8 } ],
  "coaches": [ { "id": "kaezel", "role": "coach" } ]
}
```

Weekend OTHERS row: `{ "id": "...-sat-others", "name": "OTHERS", "kind": "other", "slots": [], "coaches": [...] }`

| Field | Notes |
|---|---|
| `kind` | `"lesson"` (weekday venue), `"program"` (weekend), `"other"` (OTHERS row). |
| `slots[].time` | `"HH:MM - HH:MM"`, 24-hour, start before end. |
| `slots[].students` | Number. For programmes it's optional (blank = class not set up yet). |
| `noLesson` | Lesson cancelled that day; it has no coaches. |
| `coaches[].role` | `"lead"`, `"coach"` or `"shadow"`. |

**Not stored, worked out by the UI:** weekday WCP (available interns not at a venue), weekend WCP / DV rows
(all coaches in that base's programmes), totals, and status colours.

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

---

## 3. Endpoints

| `api.js` function | Endpoint | Sends | Gets back |
|---|---|---|---|
| `loadRoster()` | `GET /roster` | — | Roster |
| `saveDraft(roster)` | `PUT /roster` *(backend may split into `PUT /weeks/:id`, `PUT /coaches`, `PUT /venues`)* | Roster | `204` |
| `publishRoster(roster, weekId)` | `POST /weeks/:id/publish` | — (after saving) | `204`. Backend sets `status: "published"`, `changedSincePublish: false`, and triggers coach notifications (Dev 4). |
| `generateRoster(week, coaches)` | `POST /weeks/:id/generate` | — | Week with `days[].blocks[].coaches` filled in (Dev 3). |

### Errors

Return a non-2xx status with `{ "error": "Readable message for the admin" }`.
`api.js` should `throw new Error(body.error)`. The UI shows the message in red, keeps the admin's
unsaved changes, and lets them try again. A failed publish does **not** mark the week published.

### `POST /weeks/:id/generate` (Dev 3)

- Reads coaches, availability, slots and student counts from the database.
- **Keeps** valid assignments the admin already made. Fills only what's short.
- Returns the whole week in the shape above. The UI replaces that week's `days` with it.
  The admin reviews it, edits it by hand, and then saves or publishes.
- Should finish in a few seconds. The UI shows "Generating…" and disables the buttons meanwhile.
- Today's stand-in is `autoFill()` in `src/lib/roster.js`. Its tests show the expected behaviour.

---

## 4. Not done in the UI yet

- **Logins and roles (Dev 2):** the UI assumes an admin. Send a `401` and the UI will need a login screen.
- **Coach mobile view, maps and notifications (Dev 4):** they use the same Week / Coach data.
- **Two admins editing the same week:** last save wins. If that matters, the backend can return `409`
  when the week changed since it was loaded, and the UI will reload it.
