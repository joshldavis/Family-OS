-- Disposable CI only. These are the catalog fingerprints observed on the
-- shared project on 2026-10-29, not evidence of entire migration identity.
do $$
declare mismatch_count integer;
begin
  with expected(schema_name, function_name, body_md5) as (values
    ('family_os','current_family_id','e86b79b8eb28f4a04ad903083cccaeb1'),
    ('family_os','current_owner_family_id','83ec9697c2e0d52429da14f84d36b0d8'),
    ('family_os','is_family_person','c2da6849cca257a8dad6aa0ea39a0601'),
    ('family_os','stamp_completion','64887e1226f0f19f08fbbae6d7fd89be'),
    ('family_os','validate_person_references','3506530d715f76e038b346fee792a1f5'),
    ('public','is_member','73d0cfd1de3bb92ebba4a65592aba556'),
    ('public','guard_household_demo_classification','ad9e194b527c9d15f2e2135fc6dff1bc')
  )
  select count(*) into mismatch_count from expected e
  where not exists (select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname=e.schema_name and p.proname=e.function_name and md5(p.prosrc)=e.body_md5);
  if mismatch_count <> 0 then raise exception 'Candidate workspace function fingerprints differ'; end if;
  if has_table_privilege('authenticated','public.household_members','UPDATE')
    or has_column_privilege('authenticated','public.household_members','household_id','UPDATE')
    or has_column_privilege('authenticated','public.household_members','user_id','UPDATE')
    or has_column_privilege('authenticated','public.household_members','role','UPDATE')
    or has_column_privilege('authenticated','public.household_members','joined_at','UPDATE')
    or not has_column_privilege('authenticated','public.household_members','display_name','UPDATE')
    or not exists (select 1 from pg_catalog.pg_trigger t
      where t.tgrelid='public.households'::regclass
        and t.tgname='guard_household_demo_classification'
        and t.tgenabled in ('O','A') and not t.tgisinternal)
    or not (select relrowsecurity from pg_catalog.pg_class where oid='public.household_members'::regclass)
  then raise exception 'Candidate membership permissions differ'; end if;
end $$;
