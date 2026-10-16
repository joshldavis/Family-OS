-- Assert the staged security and intelligence proposals coexist with the
-- checked-in legacy schema and FOS-004. This is not a production schema audit.
do $verify$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'families', 'profiles', 'students', 'assignments',
    'family_sources', 'family_action_proposals',
    'school_agent_source_consents', 'school_agent_review_receipts',
    'school_agent_action_claims'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is null then
      raise exception 'missing staged relation %', relation_name;
    end if;
    if not (select relrowsecurity from pg_class
            where oid = to_regclass(format('public.%I', relation_name))) then
      raise exception 'RLS disabled on %', relation_name;
    end if;
  end loop;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('families', 'profiles')
      and policyname in (
        'anyone can insert a family (during onboarding)',
        'profiles: insert (onboarding)',
        'family members can update their family',
        'profiles: update own family'
      )
  ) then
    raise exception 'permissive onboarding policy survived security proposal';
  end if;

  if has_table_privilege('anon', 'public.families', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.families',
                            'INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.profiles', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.profiles',
                            'INSERT, UPDATE, DELETE') then
    raise exception 'direct client household mutation privilege survived';
  end if;

  if has_function_privilege('anon', 'public.get_my_family_id()', 'EXECUTE') then
    raise exception 'anonymous client can execute membership lookup';
  end if;
end
$verify$;
