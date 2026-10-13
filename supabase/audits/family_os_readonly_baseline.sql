-- Family OS read-only baseline audit
-- Run against the CORRECT Family OS Supabase project after project ownership
-- is verified. Contains SELECTs only. Does not return household/child records.
-- Record the date/project separately; do not check in secrets or production data.

-- 1. Table, view and RLS inventory.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind as relation_kind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  c.reltuples::bigint as planner_estimated_rows
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
order by c.relname;

-- 2. Current public-schema RLS policies; inspect permissive onboarding.
select schemaname, tablename, policyname, permissive, roles, cmd,
       qual as using_expression, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Declared columns (exclude personal row data).
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 4. Foreign keys and whether they are validated.
select c.conrelid::regclass::text as table_name,
       c.conname as constraint_name,
       pg_catalog.pg_get_constraintdef(c.oid, true) as constraint_definition,
       c.convalidated as validated
from pg_catalog.pg_constraint c
join pg_catalog.pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public' and c.contype = 'f'
order by c.conrelid::regclass::text, c.conname;

-- 5. Public functions with elevated execution privileges.
select p.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as set_config,
       p.proacl as acl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- 6. Data API grants for exposed-schema relations.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
