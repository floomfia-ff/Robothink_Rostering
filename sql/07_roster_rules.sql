-- 07: creates roster_rules, the rules Auto-Generate follows (Rules tab). Safe to run twice.
-- RLS is on with no policies, so only the roster Edge Function (service role) can read or write it.
-- kind: fixed_coach (coach_id + school_id), max_coaches (value), students_per_coach (value).

-- What is about to change: does the table already exist?
select to_regclass('public.roster_rules') as roster_rules_already_exists;

create table if not exists roster_rules (
  id         integer generated always as identity primary key,
  kind       text not null check (kind in ('fixed_coach', 'max_coaches', 'students_per_coach')),
  coach_id   integer references coaches (id) on delete cascade,
  school_id  integer references schools (id) on delete cascade,
  value      integer check (value between 1 and 20),
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);
alter table roster_rules enable row level security;

-- Starting rules, only into an empty table so a second run adds nothing.
insert into roster_rules (kind, value)
select k, v from (values ('students_per_coach', 3), ('max_coaches', 4)) as s (k, v)
where not exists (select 1 from roster_rules);

insert into roster_rules (kind, coach_id, school_id)
select 'fixed_coach', c.id, s.id from coaches c, schools s
where c.name = 'Kathleen' and s.name = 'MBR East Coast'
  and not exists (select 1 from roster_rules where kind = 'fixed_coach');
