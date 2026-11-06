# Travel times from coaches to preschools (OneMap)

**Status:** design approved in brainstorming, awaiting review of this written spec
**Owner:** Matin (backend). Branch `backend`. Spec #2 after `2026-11-01-roster-backend-design.md`.

## 1. Goal

Weekday preschool placements should favour coaches who can get there easily. For every
coach × preschool pair, work out the public transport time from the coach's nearest MRT
station to the preschool with OneMap, store it, show it when an admin picks a coach, and let
Auto-Generate prefer the closest free coach.

**Success:** after one press of "Work out travel times", the "+" list on a weekday school is
sorted by minutes, and Auto-Generate fills schools with nearer coaches. Sanity check: from
Sengkang MRT, Punggol and Toa Payoh come out shorter than Tanjong Pagar, and two or three
times agree roughly with Google Maps.

**Not in this spec:** weekends and the WCP / DV bases; measuring interns from WCP; moving
preschools to their nearest MRT; finding the lowest *total* travel over all schools.

## 2. Decisions made

| Question | Decision |
|---|---|
| How times are used | Shown in the "+" coach list (sorted, with minutes) **and** used by Auto-Generate. |
| Trip start | Every coach from their **home MRT** (`coaches.mrt_station`). |
| Trip end | The preschool's postcode (last 6 digits of `schools.address`). |
| Kind of trip | Public transport (MRT + bus), a normal **Tuesday at 14:00**, walking up to 1 km, fastest itinerary. |
| Where computed | Inside the `roster` Edge Function, stored in a new `travel_times` table. The browser never talks to OneMap. |
| When computed | Only when an admin presses **Work out travel times** (Coach Profiles). Stored times stay valid until the coach's MRT text or the school's postcode changes. |
| Missing data | Coach with no MRT or school with no postcode: skipped, time shown as "—", used last by Auto-Generate. |
| OneMap login | Matin's free OneMap account, stored as Supabase secrets `ONEMAP_EMAIL` and `ONEMAP_PASSWORD`. The function exchanges them for a token and gets a new one when it expires. |

## 3. OneMap, as observed on 2026-11-04

- **Search** `GET https://www.onemap.gov.sg/api/common/elastic/search?searchVal=…&returnGeom=Y&getAddrDetails=N&pageNum=1`
  returns `results[].LATITUDE / LONGITUDE`. It still answers without a token but warns
  "Authentication token missing", so the function always sends the token.
- **Routing** `GET https://www.onemap.gov.sg/api/public/routingsvc/route?start=lat,lng&end=lat,lng&routeType=pt&date=MM-DD-YYYY&time=HH:MM:SS&mode=TRANSIT&maxWalkDistance=1000&numItineraries=3`
  needs `Authorization: <token>`; without it, `401 {"message":"Unauthorized"}`. Trip length
  is `plan.itineraries[].duration` in seconds.
- **Token** `POST https://www.onemap.gov.sg/api/auth/post/getToken` with `{ email, password }`
  returns `access_token` and `expiry_timestamp`.

The exact response shapes are pinned by sample replies saved as test fixtures during the
build; if OneMap differs from the above, the fixtures and parser follow the real replies.

## 4. Data

**`sql/04_travel_times.sql`** (run once; RLS on, no policies, so only the function can use it):

```sql
create table if not exists travel_times (
  coach_id     integer not null,
  school_id    integer not null,
  from_station text not null,   -- the MRT text it was worked out from
  to_postcode  text not null,   -- the 6-digit postcode it was worked out to
  minutes      integer,         -- null = OneMap found no route
  status       text not null default 'ok' check (status in ('ok', 'no-route', 'station-not-found')),
  updated_at   timestamptz not null default now(),
  primary key (coach_id, school_id)
);
alter table travel_times enable row level security;
```

A row is **current** when `from_station` equals the coach's trimmed `mrt_station` and
`to_postcode` equals the school's current postcode. Anything else is treated as missing.

## 5. Function changes (`roster`)

- **`GET /`** also returns
  `travelTimes: { [coachId]: { [schoolId]: minutes | null } }` (current rows only) and
  `unrecognisedStations: [coachId…]` (coaches whose current station came back not found).
- **`POST /travel-times/refresh`** with `{ "limit": 40 }` → works out up to `limit` missing
  pairs (active coaches with an MRT × active schools with a postcode), saves each, and
  returns `{ done, remaining, total }`. Per call: each distinct station and postcode is
  searched once; routing runs a few at a time.
  - Station text gets " MRT" appended when it doesn't already contain "MRT".
  - Station not found → rows saved as `station-not-found`, `minutes` null.
  - No itinerary → `no-route`, `minutes` null.
  - Token refused → `502 { error: "OneMap didn't accept the login — check ONEMAP_EMAIL / ONEMAP_PASSWORD in Supabase." }`, nothing saved.
  - OneMap unreachable mid-batch → error returned, rows already saved stay.

Pure helpers go in `logic.js` with tests: `postcodeOf(address)`, `stationQuery(mrt)`,
`pendingPairs(coaches, schools, rows)`, `routeMinutes(onemapReply)`, `travelMap(rows, coaches, schools)`.

## 6. Site changes

- **Coach Profiles:** a "Work out travel times" button by the title. It calls the refresh
  route in a loop until `remaining` is 0, showing "Working out travel times… done / total",
  then "✓ N travel times up to date", or the error. A card whose station wasn't recognised
  shows "MRT not recognised" in orange.
- **"+" coach list on a weekday lesson:** coaches sorted by minutes to that school (unknown
  last), each showing "Sengkang MRT · 28 min" or "—". Weekend programmes and OTHERS unchanged.
- **Auto-Generate (weekday lessons):** when topping up a school, takes the free coach with
  the fewest minutes to it; unknown times last. Everything else unchanged (days off, Leads,
  existing placements, availability, weekend split). Schools are filled in day order, greedily.

## 7. Testing

- `logic.test.js`: the five helpers, using saved OneMap replies (found, not found, no route).
- `roster.test.js`: Auto-Generate picks the nearest free coach; unknown times go last; the
  existing week totals, days-off and weekend tests still pass.
- Live, after the secrets are set: refresh reaches "up to date"; the Sengkang check in §1;
  the "+" list order on one school.

## 8. Delivery

1. `sql/04_travel_times.sql`, applied after Matin's OK.
2. Matin adds `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` in Supabase → Edge Functions → Secrets.
3. Function redeployed after Matin's OK.
4. Code on `backend`, pushed and merged to `main` only when Matin says.
