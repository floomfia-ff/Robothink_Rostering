-- 04: creates travel_times, one row per coach x preschool with the OneMap public transport minutes. Safe to run twice.
-- RLS is on with no policies, so only the roster Edge Function (service role) can read or write it.

-- What is about to change: does the table already exist?
select to_regclass('public.travel_times') as travel_times_already_exists;

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
