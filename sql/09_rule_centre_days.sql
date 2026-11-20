-- 09: fixed coaches can be fixed at a centre (WCP / DV) on chosen days, not only at a preschool.
-- Only ADDS two empty columns to roster_rules; existing rules and every other table are untouched. Safe to run twice.
--   base: 'WCP' or 'DV' (null for a preschool rule)
--   days: the days a centre rule applies, e.g. {mon,tue} (null for a preschool rule: it has one lesson day)

-- What is about to change: are the columns already there? (0 = not yet)
select count(*) as columns_already_there from information_schema.columns
 where table_schema = 'public' and table_name = 'roster_rules' and column_name in ('base', 'days');

alter table roster_rules add column if not exists base text check (base in ('WCP', 'DV'));
alter table roster_rules add column if not exists days text[]
  check (days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]);

-- Check: every rule is still there, with the new columns empty.
select id, kind, coach_id, school_id, base, days, active from roster_rules order by id;
