-- FOS-004 CHECKS (READ ONLY). Run only in a disposable test database
-- after applying and testing the ledger PROPOSAL. Query returns metadata,
-- not any family rows, child names, email bodies, or approval content.
--
-- These queries cannot prove household tenant isolation by themselves:
-- require role-specific integration tests plus concurrent transaction tests.

select c.relname as table_name, c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and c.relname in ('school_agent_source_consents',
                    'school_agent_review_receipts','school_agent_action_claims')
order by c.relname;

select schemaname, tablename, policyname, roles, cmd
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('school_agent_source_consents',
                    'school_agent_review_receipts','school_agent_action_claims')
order by tablename, policyname;

select c.relname as table_name,
  has_table_privilege('anon',c.oid,'SELECT') as anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
  has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
  has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,
  has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('school_agent_source_consents',
                    'school_agent_review_receipts','school_agent_action_claims')
order by table_name;

select t.relname as table_name,
  con.conname as constraint_name, con.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class t on t.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('school_agent_source_consents',
                    'school_agent_review_receipts','school_agent_action_claims')
order by table_name, constraint_name;

-- Fail loudly on a default-open ledger, missing constraints or public grants.
do $verify$
declare
  relation_name text;
  relation_oid oid;
begin
  foreach relation_name in array array[
    'school_agent_source_consents',
    'school_agent_review_receipts',
    'school_agent_action_claims'
  ] loop
    relation_oid := to_regclass(format('public.%I',relation_name));
    if relation_oid is null then
      raise exception 'FOS-004 audit failed: missing ledger table %', relation_name;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = relation_oid and c.relrowsecurity
    ) then
      raise exception 'FOS-004 audit failed: RLS disabled on %', relation_name;
    end if;
    if has_table_privilege('anon',relation_oid,'SELECT, INSERT, UPDATE, DELETE')
       or has_table_privilege('authenticated',relation_oid,'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'FOS-004 audit failed: untrusted ledger grant on %', relation_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = relation_name
    ) then
      raise exception 'FOS-004 audit failed: unexpected client RLS policy on %', relation_name;
    end if;
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_constraint con
    join pg_catalog.pg_class t on t.oid = con.conrelid
    where t.oid = 'public.school_agent_action_claims'::regclass
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) like '%(family_id, source_id, action_kind)%'
  ) then
    raise exception 'FOS-004 audit failed: missing unique source/action claim';
  end if;
end
$verify$;
