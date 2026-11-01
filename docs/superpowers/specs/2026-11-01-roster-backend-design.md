# Roster backend: live coaches, schools and lesson plan

**Status:** design approved in brainstorming, awaiting review of this written spec
**Owner:** Matin (backend). UI: front-end dev. Engine (auto-generate): Dev 3. Notifications/maps: Dev 4.
**Branch:** `backend`, cut from `front-end-ui`. Merges back into `front-end-ui` by PR.

## 1. Goal

Replace the mock data behind the roster UI with the real data the RoboThink feedback
site already uses, so that:

1. Coaches come live from the shared Supabase `coaches` table, with their MRT station.
2. Schools (venues) come live from the shared `schools` table, with their address.
3. Each weekday lesson shows its time slots, how many children are in each slot, and how
   many are doing which build, read from the lesson plan Google Sheet.
4. The admin's own decisions (who works where, availability, weekend programmes,
   draft/published) are saved in Supabase.

**Success:** opening a real week shows the right schools on the right days with the
same student counts as the sheet; an MRT station or address changed in either site
shows up in the other on next load; no child's name ever reaches the browser.

**Not in this spec:**
- Google Maps travel time from coaches to venues. That is spec #2 and builds on the
  locations this spec makes available.
- Auto-generate (`POST /weeks/:id/generate`) stays as the UI's in-browser `autoFill()`.
  The real engine is Dev 3's.
- Notifications on publish (Dev 4).
- Coaches without an MRT station are left blank; no attempt to fill or guess them.

## 2. Decisions made

| Question | Decision |
|---|---|
| Sign-in | None. The link is shared only with the supervisor and developers. |
| How the browser reaches data | Only through a new Supabase Edge Function `roster`, which checks a secret roster code. The browser never uses the database directly, and the feedback site's public anon key gets no new permissions. |
| Children's personal data | The function reduces the sheet to counts. Names never leave the function. |
| Slots and student counts | Always read fresh from the lesson plan sheet. Never stored. |
| Weekend programmes | Entered by hand in the roster, as the UI already does. Coach names editable. No builds. |
| Saving a week | One row per week in `roster_weeks`, decisions held as JSON. |
| Employment type | New column `coaches.employment_type`, set from the roster's Coach Profiles. |
| What the roster may edit in shared tables | A coach's `mrt_station` and `employment_type`; a school's `address`. Each saves straight into the shared row, so the feedback site sees it on next load. Names, brands, class days, adding and removing stay in the feedback site. |
| Weekend bases WCP / DV | New small table `roster_bases`, editable from Venue Profiles. |
| Names in code | The UI and `docs/API_CONTRACT.md` switch to the database's column names, so everyone who pulls sees one set of names. |

## 3. Architecture

```
Roster site (browser)
   │  src/lib/api.js — every request sends header  x-roster-code
   ▼
Supabase Edge Function "roster"        supabase/functions/roster/  (this repo)
   ├─ coaches        id, name, active, mrt_station, employment_type
   ├─ schools        id, name, brand, class_day, active, address
   ├─ roster_bases   id, code, name, address                         (new)
   ├─ roster_weeks   the admin's decisions, one row per week          (new)
   └─ Google Sheet   lesson plan, read with the service account,
                     reduced to counts inside the function
```

- The function connects to Postgres with the service role key from its own environment.
  That key is never sent to the browser.
- The lesson plan parser is **copied** from the feedback project's
  `supabase/functions/read-lesson-plan/index.ts` (`parsePlan`, `serialToISO`, the
  Doubles tab reader and the Google token code). The two projects are separate repos and
  Edge Functions are deployed one at a time, so sharing the file is not practical. The
  copy carries a header comment naming its source, so a fix in one gets copied to the
  other.
- Pure logic (sheet rows → slot counts, merging a saved week with fresh slots, input
  checks) lives in one plain JavaScript module with no Deno- or browser-only imports, so
  the function and the Node tests import the same code.

## 4. Database changes

Run by hand from `sql/` in the Supabase SQL editor (or applied via the Supabase
connection on request). Each file prints what it is about to change first.

**`sql/01_coach_employment_type.sql`**
```sql
alter table coaches
  add column if not exists employment_type text not null default 'part-timer'
  check (employment_type in ('intern', 'part-timer'));
```
Default is part-timer so no one is held to the intern quota by accident. The admin marks
interns in Coach Profiles.

**`sql/02_roster_bases.sql`**
```sql
create table if not exists roster_bases (
  id      serial primary key,
  code    text not null unique,      -- 'WCP', 'DV': matches block.base
  name    text not null,
  address text
);
insert into roster_bases (code, name, address) values
  ('WCP', 'RoboThink West Coast Plaza', '154 West Coast Road, Singapore 127371'),
  ('DV',  'RoboThink Dunearn Village',  '896 Dunearn Road, Singapore 589472')
on conflict (code) do nothing;
```
Addresses are the malls' addresses; unit numbers were not publicly listed. Good enough
for routing in spec #2.

**`sql/03_roster_weeks.sql`**
```sql
create table if not exists roster_weeks (
  id                    date primary key,          -- the week's Monday
  status                text not null default 'draft' check (status in ('draft', 'published')),
  changed_since_publish boolean not null default false,
  data                  jsonb not null,
  updated_at            timestamptz not null default now()
);
```

**Row level security:** `roster_bases` and `roster_weeks` get RLS enabled with **no**
policies, so the anon and authenticated roles cannot touch them. Only the function
(service role) reads and writes them. The existing policies on `coaches` and `schools`
are not changed.

### What is inside `roster_weeks.data`

```json
{
  "availability": { "12": ["available", "off", "available", "available", "available", "available", "off"] },
  "days": [
    {
      "key": "mon",
      "blocks": [
        { "kind": "lesson", "schoolId": 3, "noLesson": false,
          "coaches": [{ "id": 12, "role": "lead" }, { "id": 7, "role": "coach" }] }
      ]
    },
    {
      "key": "sat",
      "blocks": [
        { "kind": "program", "id": "2026-11-02-sat-wcp-robotics-regular",
          "name": "WCP Robotics (Regular)", "base": "WCP",
          "slots": [{ "time": "09:00 - 16:00", "students": 8 }],
          "coaches": [{ "id": 4, "role": "coach" }] },
        { "kind": "other", "id": "2026-11-02-sat-others", "name": "OTHERS",
          "slots": [], "coaches": [] }
      ]
    }
  ]
}
```

- A weekday **lesson** stores only `schoolId`, `noLesson` and `coaches`. Its name, slots
  and counts are rebuilt on every load.
- A weekend **program** or **other** block is stored whole, because nothing else knows
  about it.
- JSON object keys are strings, so availability is keyed by the coach id as a string
  (`"12"`). Everywhere else coach ids are numbers.

## 5. Contract changes

`docs/API_CONTRACT.md`, `src/data/mockRoster.json` and every screen change in the same PR.

| Before | After |
|---|---|
| Coach `{ id: "ameer", name, type, mrt }` | Coach `{ id: 12, name, active, employment_type, mrt_station }` |
| Venue `{ name, address, postalCode }`, keyed by name | Schools `{ id: 3, name, brand, class_day, address }`; bases from `roster_bases` as `{ id, code, name, address }` |
| Coach ids in `blocks[].coaches` and `availability` are text | Numbers (availability keys are the number as a string) |
| Lesson block `{ id, name, kind, slots, coaches }` | Adds `schoolId`. Each slot adds `builds`: `{ time: "16:00 - 17:00", students: 8, builds: [{ build: "L1-2A …", students: 3 }] }` |
| `postalCode` field and its input | Removed. Venue Profiles checks that `address` ends in a 6-digit postal code. |

Known uses to update (from `grep`): `AvailabilityPanel.jsx`, `CoachChip.jsx`,
`CoachProfiles.jsx`, `CoachSwapModal.jsx`, `VenueProfiles.jsx`, `WeeklyGrid.jsx`,
`RosterContext.jsx`, `lib/export.js`, `lib/roster.js`, `lib/roster.test.js`,
`data/mockRoster.json`.

### Endpoints

All requests go to the one function and carry `x-roster-code`. `api.js` keeps its
existing function names, so screens only change where field names change.

| `api.js` function | Request | Does |
|---|---|---|
| `loadRoster(weekIds)` | `GET ?weeks=2026-11-02,2026-11-09` | Coaches, schools, bases, and each requested week (saved decisions merged with fresh slots) |
| `saveDraft(roster)` | `PUT /weeks/:id` per changed week | Upserts the week's decisions. Sets `changed_since_publish` if the week was published. |
| `saveCoach(id, fields)` (new) | `PATCH /coaches/:id` | Only `mrt_station`, `employment_type` |
| `saveVenue(kind, id, fields)` (new) | `PATCH /schools/:id` or `/bases/:id` | Only `address` |
| `publishRoster(roster, weekId)` | save, then `POST /weeks/:id/publish` | `status = 'published'`, `changed_since_publish = false` |
| `generateRoster(week, coaches)` | none | Unchanged: in-browser `autoFill()` |

Errors keep the contract's shape: non-2xx with `{ "error": "Readable message" }`, and
`api.js` throws `new Error(body.error)`.

## 6. Building a week

For week `W` (a Monday):

1. Load all coaches (inactive ones are needed for past weeks), active schools, bases, and
   the `roster_weeks` row for `W` if any.
2. Read the lesson plan sheet and parse it with the copied `parsePlan`.
3. For each weekday Mon–Fri, for each active school whose `class_day` matches:
   - Find the sheet school with the same name, ignoring case and surrounding spaces
     (the feedback site's `sameSchool`).
   - Take the children who had started by that date, had not left, and have a build on
     that date (the same filter as the feedback site's `monthPages`).
   - Group by class time into slots, sorted by start time. Each slot is
     `{ time, students, builds: [{ build, students }] }`, builds sorted by count (high
     first) then name. A double ("A & B" recorded on the Doubles tab) counts the child
     once in `students` and once under its cell text in `builds`.
   - No children that date → the block is `noLesson: true` (holiday).
4. Lay saved decisions on top: a saved lesson block with the same `schoolId` keeps its
   `coaches` and `noLesson`; saved weekend blocks are used as they are.
5. A week with no saved row is a draft with no coaches, and its weekend programmes are
   copied (without coaches) from the most recent earlier saved week, or none if there is
   no earlier week.

Sheet time text is normalised to the contract's `"HH:MM - HH:MM"` (24-hour), for example
`1600 - 1700` → `16:00 - 17:00`.

## 7. When things go wrong

| Situation | Behaviour |
|---|---|
| Sheet cannot be read | Coaches, schools and saved decisions still load. Response carries `planError: "…"`; lesson blocks have `slots: []` and the UI shows "Lesson plan unavailable: …". Saving still works. |
| School in the database but not on the sheet | Block has no slots. Response carries `unmatchedSchools: [names]`, shown as a warning so the spelling can be fixed. |
| Holiday (no children that date) | `noLesson: true`, grey. |
| Coach deactivated after being rostered | Returned in `coaches` with `active: false`; shown as "(inactive)" on weeks that already have them; cannot be placed on new days. |
| School deactivated | Not shown on weeks that are still drafts. Published weeks keep the block, marked inactive. |
| Missing or wrong roster code | `401 { error: "Roster code not accepted." }`. Nothing read or saved. |
| Bad input | `400` with a readable error for: an employment type other than intern / part-timer; an address not ending in a 6-digit postal code; a week id that is not a Monday; a coach id that does not exist. |
| Two people saving the same week | Last save wins, as the contract already states. |

## 8. Settings and secrets

| Where | Name | What |
|---|---|---|
| `.env.local` (from `.env.example`) | `VITE_ROSTER_API_URL` | The `roster` function's URL |
| `.env.local` | `VITE_ROSTER_CODE` | The shared roster code |
| Supabase → Edge Functions → Secrets | `ROSTER_CODE` | Same value as above |
| Supabase secrets (already set for the feedback site) | `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_PLAN_SHEET_ID` | Reused |
| Provided by Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Used only inside the function |

**Accepted risk:** `VITE_ROSTER_CODE` is compiled into the site's JavaScript, so anyone who
has the site's link can use the roster, including editing MRT stations, employment types
and addresses. This was chosen over a sign-in because the link is shared only with the
supervisor and developers. If the link spreads, change `ROSTER_CODE` and rebuild. The
lesson plan exposure is limited to counts and build names either way.

The function is deployed by pasting it into Supabase → Edge Functions, as in the
feedback project, with **Verify JWT turned off** (the roster code replaces it).

## 9. Testing

- `npm test` runs plain Node tests, as the repo does today.
- New tests for the shared logic module:
  - slots are grouped and counted correctly from a sample of sheet rows, including a
    double, a child who has left and a child not yet started;
  - time text is normalised;
  - a saved week merges with fresh slots, keeping coaches and dropping stale counts;
  - address and week-id checks accept and reject the right inputs;
  - **privacy:** a sample containing children's names produces output in which none of
    those names appear anywhere (checked on the serialised JSON).
- `src/lib/roster.test.js` is updated for the renamed fields and must still pass.
- Manual check against the real Supabase and sheet: one real week's counts match the
  sheet; an MRT station edited in the roster appears in the feedback site's Coaches tab;
  a wrong roster code gets the 401 message.

## 10. Delivery

- All work on `backend`. PR into `front-end-ui` so the UI owner reviews the renames to
  their screens before anything reaches `main`.
- `docs/API_CONTRACT.md` is updated in the same PR, per the UI owner's request.
- SQL files are committed under `sql/` so every developer can see what changed in the
  shared database.
