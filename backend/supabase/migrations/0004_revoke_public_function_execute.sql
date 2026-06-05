revoke execute on all functions in schema public from public;

alter default privileges in schema public revoke execute on functions from public;
