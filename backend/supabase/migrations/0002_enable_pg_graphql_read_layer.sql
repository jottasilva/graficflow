create extension if not exists pg_graphql;

comment on schema public is e'@graphql({"inflect_names": true})';
