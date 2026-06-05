-- DANGER: irreversible destructive cleanup.
-- Run only after an explicit confirmation from the project owner.
-- This removes every table in schema public, then migrations can recreate only GraphFlow tables.

do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table if exists %I.%I cascade', table_record.schemaname, table_record.tablename);
  end loop;
end $$;
