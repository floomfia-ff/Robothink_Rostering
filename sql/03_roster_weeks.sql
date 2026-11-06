-- 03: creates roster_weeks, one row per week (id = that week's Monday), holding the admin's decisions as JSON.
-- Safe to run twice. RLS is on with no policies, so only the roster Edge Function (service role) can touch it.

-- What is about to change: does the table already exist?
select to_regclass('public.roster_weeks') as roster_weeks_already_exists;

create table if not exists roster_weeks (
  id                    date primary key,          -- the week's Monday
  status                text not null default 'draft' check (status in ('draft', 'published')),
  changed_since_publish boolean not null default false,
  data                  jsonb not null,
  updated_at            timestamptz not null default now()
);

alter table roster_weeks enable row level security;
