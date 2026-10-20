-- REVIEW PROPOSAL ONLY. Apply only to disposable PostgreSQL for verification.
-- The privileged account-deletion workflow must call this in the SAME
-- transaction as deleting the household. No service-role or browser grant.
begin;

do $$ begin
  if to_regclass('family_os.school_agent_erasure_marks') is null
    or to_regclass('family_os.school_agent_execution_receipts') is null
    or to_regprocedure('public.school_agent_execute_reviewed_assignment(uuid,uuid,uuid,uuid,text,uuid)') is null
  then raise exception 'FOS-008 requires reviewed FOS-006 and FOS-007 proposals'; end if;
end $$;

create function family_os.school_agent_erase_family(p_family_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_assignment_ids text[];
  v_assignment_count integer;
  v_receipt_count integer;
begin
  if current_user <> 'postgres' then
    raise exception 'School Agent erasure requires privileged operator'
      using errcode = '42501';
  end if;
  if p_family_id is null then raise exception 'Household ID required'; end if;

  -- The RPC takes a SHARE lock on the same row. The FK parent lock also
  -- blocks concurrent inserts of family-scoped School Agent records.
  perform 1 from public.households where id=p_family_id for update;
  if not found then raise exception 'Household not found'; end if;
  perform pg_catalog.set_config('family_os.erasing_family',p_family_id::text,true);
  insert into family_os.school_agent_erasure_marks(family_id)
  values (p_family_id) on conflict (family_id) do nothing;

  select coalesce(array_agg(assignment_id),array[]::text[])
  into v_assignment_ids from family_os.school_agent_action_claims
  where family_id=p_family_id and assignment_id is not null;
  if exists (
    select 1 from family_os.assignments a
    where a.family_id=p_family_id and a.id=any(v_assignment_ids)
      and (a.source is distinct from 'AI' or a.id !~ '^school:')
  ) then raise exception 'Claim references a non-agent assignment'; end if;

  delete from family_os.school_agent_execution_receipts
  where family_id=p_family_id;
  get diagnostics v_receipt_count = row_count;
  delete from family_os.school_agent_action_claims where family_id=p_family_id;
  delete from family_os.school_agent_review_receipts where family_id=p_family_id;
  delete from family_os.family_action_proposals where family_id=p_family_id;
  delete from family_os.school_agent_source_consents where family_id=p_family_id;
  delete from family_os.family_sources where family_id=p_family_id;
  delete from family_os.assignments
  where family_id=p_family_id and id=any(v_assignment_ids);
  get diagnostics v_assignment_count = row_count;

  if exists (select 1 from family_os.family_sources where family_id=p_family_id)
    or exists (select 1 from family_os.family_action_proposals where family_id=p_family_id)
    or exists (select 1 from family_os.school_agent_source_consents where family_id=p_family_id)
    or exists (select 1 from family_os.school_agent_review_receipts where family_id=p_family_id)
    or exists (select 1 from family_os.school_agent_action_claims where family_id=p_family_id)
    or exists (select 1 from family_os.school_agent_execution_receipts where family_id=p_family_id)
    or exists (select 1 from family_os.assignments
               where family_id=p_family_id and id=any(v_assignment_ids))
  then raise exception 'School Agent erasure was incomplete'; end if;

  return jsonb_build_object('familyId',p_family_id,'receiptsDeleted',v_receipt_count,
    'assignmentsDeleted',v_assignment_count);
end $$;
revoke all on function family_os.school_agent_erase_family(uuid)
  from public, anon, authenticated, service_role;

commit;
