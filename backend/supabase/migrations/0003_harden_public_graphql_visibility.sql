revoke select, insert, update, delete on all tables in schema public from anon, authenticated;
revoke usage, select, update on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges in schema public revoke usage, select, update on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
