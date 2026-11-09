-- 08: adds coaches.coach_level (beginner / intermediate / advanced). Safe to run twice.
-- Only adds a column: can_lead and every other column stay as they are.
-- Coaches already marked Lead Coach (can_lead = true) start as advanced, everyone else as beginner.

-- What is about to change: is the column already there?
select count(*) as column_already_exists from information_schema.columns
 where table_schema = 'public' and table_name = 'coaches' and column_name = 'coach_level';

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'coaches' and column_name = 'coach_level') then
    alter table coaches add column coach_level text not null default 'beginner'
      check (coach_level in ('beginner', 'intermediate', 'advanced'));
    update coaches set coach_level = 'advanced' where can_lead; -- only on the first run, so later edits are kept
  end if;
end $$;
