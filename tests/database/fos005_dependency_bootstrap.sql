-- Disposable vanilla PostgreSQL stand-ins for Supabase-owned objects.
-- No real Auth user or family data is copied into this rehearsal.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create publication supabase_realtime;
