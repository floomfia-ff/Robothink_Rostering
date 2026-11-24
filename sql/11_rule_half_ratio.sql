-- 11: lets "Students per coach" be a half number (3.5), so a ratio can sit between two whole ones.
-- Only CHANGES THE TYPE of roster_rules.value from integer to numeric. No row is added, removed or
-- re-valued: 3 stays 3 (shown as 3.0). Every other table and column is untouched. Safe to run twice.

-- What is about to change: the column's type today, the checks on it, and the values stored in it.
select data_type, numeric_precision, numeric_scale from information_schema.columns
 where table_schema = 'public' and table_name = 'roster_rules' and column_name = 'value';
select conname, pg_get_constraintdef(oid) as definition from pg_constraint
 where conrelid = 'public.roster_rules'::regclass and contype = 'c';
select id, kind, value from roster_rules where value is not null order by id;

-- Drop whatever check currently guards `value`, found by column rather than by name, so this works
-- even if the constraint was auto-named something else. Re-running drops the new one and re-adds it.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
     where con.conrelid = 'public.roster_rules'::regclass
       and con.contype = 'c'
       and att.attname = 'value'
  loop
    execute format('alter table public.roster_rules drop constraint %I', c.conname);
  end loop;
end $$;

-- integer -> numeric(4,1): up to 999.9, so one decimal place.
alter table public.roster_rules alter column value type numeric(4,1);

-- Back to 1..20, now in steps of 0.5. Every existing whole number already satisfies it.
alter table public.roster_rules add constraint roster_rules_value_check
  check (value is null or (value between 1 and 20 and (value * 2) = floor(value * 2)));

-- What it looks like afterwards: numeric / scale 1, the new check, and the same values as above.
select data_type, numeric_precision, numeric_scale from information_schema.columns
 where table_schema = 'public' and table_name = 'roster_rules' and column_name = 'value';
select conname, pg_get_constraintdef(oid) as definition from pg_constraint
 where conrelid = 'public.roster_rules'::regclass and contype = 'c';
select id, kind, value from roster_rules where value is not null order by id;
