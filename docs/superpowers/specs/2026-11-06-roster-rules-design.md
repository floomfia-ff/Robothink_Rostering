# Roster rules for Auto-Generate

**Status:** design approved in brainstorming, awaiting review of this written spec
**Owner:** Matin (backend). Branch `backend`. Spec #3 after `2026-11-04-travel-times-design.md`.

## 1. Goal

Let the admin set rules that Auto-Generate always follows, on a new **Rules** tab, and make the
weekday fill match how schools are really staffed: a regular coach stays at their school, no school
gets more than 4 coaches, about 1 coach per 3 kids, the busiest schools are served first, and the
rest stay at WCP.

**Success:** with Kathleen fixed at MBR East Coast, ratio 3 and max 4, Auto-Generate on a real week
puts Kathleen at East Coast every Thursday she works, gives Tanjong Pagar (8 kids) 3 coaches, never
puts more than 4 at a school, and leaves extra interns at WCP. New rule types can be added later
without a database change.

**Not in this spec:** an AI that reads plain-English rules or builds the roster; per-school ratios
or per-school maximums (one global value each for now); rules for weekends or WCP / DV; other rule
types (keep apart, never at school X, preferred school). Section 6 says where those slot in.

## 2. Decisions made

| Question | Decision |
|---|---|
| How rules are given | A **Rules tab** with fixed rule types, saved in Supabase. No AI. |
| Rules for now | `fixed_coach` (coach → school), `max_coaches` (4), `students_per_coach` (3). |
| Fixed coach | Placed first whenever that school has a lesson that day and the coach is free. Otherwise the coach is treated like anyone else. |
| Target per school | `min(max_coaches, ceil(largest slot's students / students_per_coach))`. 8 kids → 3, 11 → 4, 15 → 4. |
| When coaches are short | The **busiest school picks first** (most kids per coach), taking its nearest free coach. |
| Coaches not needed | **Stay unplaced (WCP).** The current "place everyone" step is removed. |
| Hard vs soft | Fixed coaches and the max are never broken by Auto-Generate. Breaking them by hand is allowed and shows a warning. |

## 3. Data

New table `roster_rules` (SQL file `sql/07_roster_rules.sql`), RLS on with no policies, like the
other roster tables; only the Edge Function (service role) reads and writes it.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint identity | primary key |
| `kind` | text not null | `fixed_coach`, `max_coaches` or `students_per_coach` |
| `coach_id` | bigint null → `coaches.id` on delete cascade | used by `fixed_coach` |
| `school_id` | bigint null → `schools.id` on delete cascade | used by `fixed_coach` |
| `value` | int null | used by `max_coaches` and `students_per_coach` (1–20) |
| `active` | boolean not null default true | off = ignored, kept for later |
| `note` | text null | free text for the admin |
| `created_at` | timestamptz default now() | |

Starting rows: `students_per_coach` = 3, `max_coaches` = 4, `fixed_coach` Kathleen → MBR East Coast.
There is at most one active `max_coaches` and one active `students_per_coach` row; if either is
missing, the code uses 4 and 3.

## 4. Edge Function (`roster`)

- `GET /` also returns `rules: [{ id, kind, coach_id, school_id, value, active, note }]`.
- `POST /rules` creates one rule; `PATCH /rules/:id` changes `value`, `active`, `note`, `coach_id`
  or `school_id`; `DELETE /rules/:id` removes it. All return `204` (POST returns `{ id }`).
- Checks, in `logic.js` (`validateRule`, tested in Node): `kind` is one of the three; a
  `fixed_coach` has a known coach and a known school; `value` is a whole number 1–20 for the two
  number kinds; a second `fixed_coach` for the same coach and school is refused. Errors are `400`
  with a readable message.

## 5. Auto-Generate (`autoFill` in `src/lib/roster.js`)

`autoFill(week, coaches, travel, rules)`. Weekdays only; weekends, intern days off and the weekend
split are unchanged. For each weekday:

1. **Keep** hand placements that are still valid (as now: drop anyone off, unavailable or booked twice).
2. **Fixed coaches:** for each active `fixed_coach` rule whose school has a lesson that day, place
   the coach there if they are free.
3. **Targets:** each school's target is `min(max, ceil(students / ratio))`.
4. **Lead Coach coverage:** while a school has no Lead Coach and is under its target, the busiest
   such school takes its nearest free Lead Coach.
5. **Fill:** while a school is under its target and someone is free, the school with the most kids
   per coach takes its nearest free coach. Part-timers working that day go before interns; a second
   Lead Coach at one school is a last resort (both as now).
6. **Stop:** anyone still free stays unplaced (WCP).
7. **Swap:** two coaches placed in steps 4–5 who are not Lead Coaches and are the same type trade
   schools when that shortens their trips together. Fixed and hand-placed coaches never move.
8. **Leads:** a Lead Coach leads where there is one; Leads are shared out fairly (as now).

**Warnings** (`ruleWarnings(week, coaches, rules)`, shown in the warnings pill, never blocking):
- "THU 12-Nov: Kathleen is fixed at MBR East Coast but is off." (or "…is at MBR Creative.")
- "MON 9-Nov: MBR Dover has 5 coaches, more than the max of 4."

Unchanged: the green OK badge (it means the school has a Lead), the "+" picker, Find coaches,
Clear coaches, weekend programmes.

## 6. Rules tab (`src/components/RulesTab.jsx`)

A fourth section tab, **Rules**, between Venues and Admin, in the same card style as Coach Profiles
and Venues:

- **Numbers** card: "Students per coach" (3) and "Max coaches per school" (4), small number boxes.
- **Fixed coaches** card: one row per rule ("Kathleen → MBR East Coast"), with an on/off toggle and a
  delete ×. An "Add fixed coach" row has a coach picker, a school picker (weekday preschools) and an
  Add button.
- Each change goes straight to the server, not through week auto-save: Add, delete and the toggle
  send at once; a number box sends when it loses focus or Enter is pressed. The tab shows the usual
  save status, and a failed change is undone on screen with the error shown.

A later rule type gets its own `kind`, its own card on this tab, its own check in `validateRule`
and its own step in `autoFill`; the table does not change.

## 7. Testing

- `roster.test.js`: fixed coach placed first; fixed coach on a day the school has no lesson is free
  for others; never more than the max; 8 kids → 3 coaches; busiest school served first when short;
  leftovers stay unplaced; fixed and hand-placed coaches never swapped; both warnings; no rules →
  ratio 3 and max 4.
- `logic.test.js`: `validateRule` accepts good rules and refuses bad kinds, unknown coach or school,
  bad numbers and duplicate fixed coaches.
- Dry run on the real weeks (no save) before committing, and a browser check of the Rules tab
  (add, toggle, delete, change numbers) on throwaway rules that are removed afterwards.

## 8. Rollout

Apply `sql/07_roster_rules.sql` (with the starting rows), deploy the `roster` function, then push.
Each step asks first, as before. `docs/API_CONTRACT.md` gets the `rules` field, the three routes and
the new Auto-Generate order.
