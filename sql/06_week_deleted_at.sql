-- 06: adds roster_weeks.deleted_at. "Delete week" sets it instead of removing the row, so the week can be restored. Safe to run twice.
alter table roster_weeks add column if not exists deleted_at timestamptz;
