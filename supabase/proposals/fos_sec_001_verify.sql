-- FOS-SEC-001 policy verification (READ-ONLY; no family rows selected)
-- Intended AFTER applying proposed lockdown in a disposable database.
-- Do not claim that this replaces live RLS integration testing.

select
  'families' as relation,
  has_table_privilege('anon', 'public.families', 'INSERT') as anon_can_insert,
  has_table_privilege('authenticated', 'public.families', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.families', 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', 'public.families', 'DELETE') as authenticated_can_delete
union all
select
  'profiles',
  has_table_privilege('anon', 'public.profiles', 'INSERT'),
  has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  has_table_privilege('authenticated', 'public.profiles', 'DELETE');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename in ('families', 'profiles')
order by tablename, policyname;

select
  has_function_privilege('anon', 'public.get_my_family_id()', 'EXECUTE') as anon_can_read_membership_lookup,
  has_function_privilege('authenticated', 'public.get_my_family_id()', 'EXECUTE') as member_can_read_membership_lookup;

select p.proname, p.prosecdef, p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_my_family_id';

-- Fails loudly if the tables still grant untrusted mutation.
do $fos_security_verify$
begin
  if (
    has_table_privilege('anon', 'public.families', 'INSERT')
    or has_table_privilege('authenticated', 'public.families', 'INSERT')
    or has_table_privilege('authenticated', 'public.families', 'UPDATE')
    or has_table_privilege('authenticated', 'public.families', 'DELETE')
    or has_table_privilege('anon', 'public.profiles', 'INSERT')
    or has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
  ) then
    raise exception 'FOS-SEC-001 FAILED: untrusted roles still have family/profile mutation privileges';
  end if;

  if has_function_privilege('anon', 'public.get_my_family_id()', 'EXECUTE') then
    raise exception 'FOS-SEC-001 FAILED: anonymous clients can execute membership lookup';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_family_id()', 'EXECUTE') then
    raise exception 'FOS-SEC-001 FAILED: authenticated members cannot execute membership lookup';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexname = 'profiles_unique_authenticated_identity'
  ) then
    raise exception 'FOS-SEC-001 FAILED: unique auth identity index missing';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in ('families', 'profiles')
      and cmd in ('INSERT', 'UPDATE', 'ALL')
  ) then
    raise exception 'FOS-SEC-001 FAILED: unexpected mutation policy for families or profiles';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('families', 'profiles')
      and not c.relrowsecurity
  ) then
    raise exception 'FOS-SEC-001 FAILED: RLS disabled';
  end if;
end;
$fos_security_verify$;
