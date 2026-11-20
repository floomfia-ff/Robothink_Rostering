-- 01: adds coaches.employment_type ('intern' or 'part-timer'). Safe to run twice.
-- Existing coaches get 'part-timer' (the default), so no one is held to the intern quota by accident.

-- What is about to change: is the column already there, and how many coaches will be affected?
select
  (select count(*) from information_schema.columns
    where table_name = 'coaches' and column_name = 'employment_type') as column_already_exists,
  (select count(*) from coaches) as coaches_total;

alter table coaches
  add column if not exists employment_type text not null default 'part-timer'
  check (employment_type in ('intern', 'part-timer'));
