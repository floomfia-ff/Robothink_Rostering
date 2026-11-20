-- 02: creates roster_bases (the weekend bases WCP and DV) and seeds them. Safe to run twice.
-- RLS is on with no policies, so only the roster Edge Function (service role) can read or write it.

-- What is about to change: does the table already exist?
select to_regclass('public.roster_bases') as roster_bases_already_exists;

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

alter table roster_bases enable row level security;
