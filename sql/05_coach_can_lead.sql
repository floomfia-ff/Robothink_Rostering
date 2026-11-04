-- 05: adds coaches.can_lead (experienced enough to be a weekday Lead). Safe to run twice.
-- Everyone starts as false; the admin ticks "Can lead" in the roster's Coach Profiles.

-- What is about to change: is the column already there?
select count(*) as column_already_exists from information_schema.columns
 where table_schema = 'public' and table_name = 'coaches' and column_name = 'can_lead';

alter table coaches add column if not exists can_lead boolean not null default false;
