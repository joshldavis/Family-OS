-- REVIEW PROPOSAL ONLY. Apply only to disposable PostgreSQL during CI.
-- Depends on the reviewed FOS-006 UUID ledger proposal. This is not a live
-- migration; never execute it on made-again before the full cutover review.
begin;

do $$
begin
  if to_regclass('family_os.family_action_proposals') is null
    or to_regclass('family_os.school_agent_action_claims') is null
    or to_regprocedure('family_os.school_agent_session_active(uuid,uuid)') is null
  then raise exception 'FOS-007 requires the reviewed FOS-006 ledger'; end if;
  if to_regprocedure('public.school_agent_execute_reviewed_assignment(uuid,uuid,uuid,uuid,text,uuid)') is not null
    or to_regprocedure('family_os.school_agent_proposal_revision(uuid,uuid,text,text,date,text,timestamp with time zone,boolean,boolean,boolean)') is not null
  then raise exception 'FOS-007 target already exists; reconcile before applying'; end if;
end $$;

-- Match trustedProposalRevision() in TypeScript byte for byte. Building each
-- JSON scalar separately avoids json/jsonb array whitespace differences.
-- CI compares this function against JavaScript golden vectors before any RPC
-- execution test. The approved proposal itself is immutable under FOS-006.
create function family_os.school_agent_proposal_revision(
  p_id uuid, p_family_id uuid, p_source_ref_digest text, p_title text,
  p_date date, p_student_id text, p_consent_captured_at timestamptz,
  p_title_confirmed boolean, p_student_confirmed boolean,
  p_date_confirmed boolean
) returns text language sql stable security invoker set search_path = '' as $$
  select encode(sha256(convert_to('[' || array_to_string(array[
    to_json('family-os-school-proposal-v1'::text)::text,
    to_json(p_id::text)::text,
    to_json(p_family_id::text)::text,
    to_json('school_email'::text)::text,
    to_json(p_source_ref_digest)::text,
    to_json('assignment'::text)::text,
    to_json(p_title)::text,
    coalesce(to_json(to_char(p_date, 'YYYY-MM-DD'))::text, 'null'),
    coalesce(to_json(p_student_id)::text, 'null'),
    to_json('ready_for_review'::text)::text,
    coalesce(to_json(to_char(p_consent_captured_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text, 'null'),
    to_json('active'::text)::text,
    to_json(p_title_confirmed)::text,
    to_json(p_student_confirmed)::text,
    to_json(p_date_confirmed)::text
  ], ',') || ']', 'UTF8')), 'hex')
$$;
revoke all on function family_os.school_agent_proposal_revision(
  uuid,uuid,text,text,date,text,timestamptz,boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function family_os.school_agent_proposal_revision(
  uuid,uuid,text,text,date,text,timestamptz,boolean,boolean,boolean)
  to service_role;

create function family_os.school_agent_action_digest(p_family_id uuid, p_source_id uuid)
returns text language sql immutable security invoker set search_path = '' as $$
  select encode(sha256(convert_to('[' || array_to_string(array[
    to_json('fos-004-v1'::text)::text,
    to_json(p_family_id::text)::text,
    to_json(p_source_id::text)::text,
    to_json('create_schoolwork_assignment'::text)::text
  ], ',') || ']', 'UTF8')), 'hex')
$$;
revoke all on function family_os.school_agent_action_digest(uuid,uuid)
  from public, anon, authenticated;
grant execute on function family_os.school_agent_action_digest(uuid,uuid)
  to service_role;

-- One POST /rest/v1/rpc request is one database transaction. The caller is a
-- server-only service-role client, separate from the client that verifies the
-- parent's bearer token with Supabase Auth. Never expose this to browser roles.
-- Unexpected SQL errors are intentionally uncaught and roll back all writes.
create function public.school_agent_execute_reviewed_assignment(
  p_actor_auth_id uuid, p_session_id uuid, p_family_id uuid,
  p_proposal_id uuid, p_expected_revision text, p_approval_id uuid
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_owner record;
  v_proposal family_os.family_action_proposals%rowtype;
  v_source family_os.family_sources%rowtype;
  v_consent family_os.school_agent_source_consents%rowtype;
  v_review family_os.school_agent_review_receipts%rowtype;
  v_student record;
  v_revision text;
  v_claim_id uuid;
  v_prior_status text;
  v_prior_receipt_id uuid;
  v_assignment_id text;
  v_receipt_id uuid;
begin
  if p_actor_auth_id is null or p_session_id is null or p_family_id is null
    or p_proposal_id is null or p_approval_id is null
    or p_expected_revision is null
    or p_expected_revision !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok',false,'executed',false,'reason','invalid_request');
  end if;
  if not family_os.school_agent_session_active(p_actor_auth_id,p_session_id) then
    return jsonb_build_object('ok',false,'executed',false,'reason','inactive_session');
  end if;

  select m.household_id into v_owner
  from public.household_members m
  join public.profiles p on p.user_id=m.user_id
  join public.households h on h.id=m.household_id
  where m.household_id=p_family_id and m.user_id=p_actor_auth_id
    and m.role='owner' and p.current_household_id=m.household_id
    and not h.is_demo
  for share of m,p,h;
  if not found then
    return jsonb_build_object('ok',false,'executed',false,'reason','membership_denied');
  end if;
  if exists (select 1 from family_os.school_agent_erasure_marks
             where family_id=p_family_id) then
    return jsonb_build_object('ok',false,'executed',false,'reason','family_erasing');
  end if;

  select * into v_proposal from family_os.family_action_proposals
  where family_id=p_family_id and id=p_proposal_id for update;
  if not found then
    return jsonb_build_object('ok',false,'executed',false,'reason','source_not_found');
  end if;
  select * into v_source from family_os.family_sources
  where family_id=p_family_id and id=v_proposal.source_id for share;
  if not found or v_source.source_system <> 'school_email'
    or v_source.source_ref_digest is distinct from v_proposal.source_ref_digest then
    return jsonb_build_object('ok',false,'executed',false,'reason','source_not_found');
  end if;
  select * into v_consent from family_os.school_agent_source_consents
  where family_id=p_family_id and source_id=v_source.id for share;
  if not found or v_consent.status <> 'active'
    or v_consent.grant_version <> v_proposal.consent_grant_version
    or v_consent.granted_at is null or v_proposal.consent_captured_at is null then
    return jsonb_build_object('ok',false,'executed',false,'reason','consent_denied');
  end if;
  v_revision := family_os.school_agent_proposal_revision(
    v_proposal.id,v_proposal.family_id,v_proposal.source_ref_digest,
    v_proposal.title,v_proposal.due_date,v_proposal.student_id,
    v_proposal.consent_captured_at,v_proposal.title_confirmed_by_parent,
    v_proposal.student_confirmed_by_parent,v_proposal.date_confirmed_by_parent);
  if v_proposal.source_revision <> p_expected_revision
    or v_proposal.source_revision <> v_revision then
    return jsonb_build_object('ok',false,'executed',false,'reason','stale_source');
  end if;
  if v_proposal.status not in ('approved','executed')
    or btrim(v_proposal.title) = ''
    or v_proposal.title !~ '^[^[:cntrl:]]{1,200}$'
    or not (v_proposal.title_confirmed_by_parent
      and v_proposal.student_confirmed_by_parent
      and v_proposal.date_confirmed_by_parent) then
    return jsonb_build_object('ok',false,'executed',false,'reason','unconfirmed_assignment');
  end if;
  select 1 into v_student from family_os.students
  where family_id=p_family_id and id=v_proposal.student_id for share;
  if not found then
    return jsonb_build_object('ok',false,'executed',false,'reason','student_not_verified');
  end if;
  select * into v_review from family_os.school_agent_review_receipts
  where family_id=p_family_id and id=p_approval_id;
  if not found or v_review.proposal_id <> v_proposal.id
    or v_review.source_id <> v_source.id
    or v_review.source_revision <> v_proposal.source_revision
    or v_review.consent_grant_version <> v_proposal.consent_grant_version
    or v_review.decision <> 'approved'
    or v_review.reviewed_by_auth_id <> p_actor_auth_id
    or v_review.confirmed_title is distinct from v_proposal.title
    or v_review.confirmed_student_id is distinct from v_proposal.student_id
    or v_review.confirmed_due_date is distinct from v_proposal.due_date then
    return jsonb_build_object('ok',false,'executed',false,'reason','approval_denied');
  end if;

  if v_proposal.status='approved' then
    insert into family_os.school_agent_action_claims
      (family_id,source_id,proposal_id,approved_receipt_id,action_kind,
       source_revision,idempotency_digest)
    values (p_family_id,v_source.id,v_proposal.id,v_review.id,
      'create_schoolwork_assignment',v_proposal.source_revision,
      family_os.school_agent_action_digest(p_family_id,v_source.id))
    on conflict (family_id,source_id,action_kind) do nothing
    returning id into v_claim_id;
  end if;
  if v_claim_id is null then
    select c.status,r.id into v_prior_status,v_prior_receipt_id
    from family_os.school_agent_action_claims c
    left join family_os.school_agent_execution_receipts r
      on r.family_id=c.family_id and r.claim_id=c.id
    where c.family_id=p_family_id and c.source_id=v_source.id
      and c.action_kind='create_schoolwork_assignment'
    for update of c;
    if v_prior_status='executed' and v_prior_receipt_id is not null then
      return jsonb_build_object('ok',true,'executed',false,
        'reason','already_executed','familyId',p_family_id);
    end if;
    return jsonb_build_object('ok',false,'executed',false,'reason','duplicate_pending');
  end if;

  v_assignment_id := 'school:' || gen_random_uuid()::text;
  insert into family_os.assignments
    (id,family_id,student_id,title,due_date,source)
  values (v_assignment_id,p_family_id,v_proposal.student_id,
    v_proposal.title,v_proposal.due_date,'AI');
  update family_os.school_agent_action_claims
  set status='executed',assignment_id=v_assignment_id,
    executed_by_auth_id=p_actor_auth_id,executed_at=now()
  where family_id=p_family_id and id=v_claim_id and status='claimed';
  if not found then raise exception 'Claim finalization failed'; end if;
  insert into family_os.school_agent_execution_receipts
    (family_id,claim_id,assignment_id,source_revision,actor_auth_user_id)
  values (p_family_id,v_claim_id,v_assignment_id,
    v_proposal.source_revision,p_actor_auth_id)
  returning id into v_receipt_id;
  update family_os.family_action_proposals set status='executed'
  where family_id=p_family_id and id=v_proposal.id and status='approved';
  if not found or v_receipt_id is null then
    raise exception 'Execution receipt or proposal update failed';
  end if;
  return jsonb_build_object('ok',true,'executed',true,
    'familyId',p_family_id,'assignmentId',v_assignment_id,
    'actionReceiptId',v_receipt_id);
end $$;
revoke all on function public.school_agent_execute_reviewed_assignment(
  uuid,uuid,uuid,uuid,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.school_agent_execute_reviewed_assignment(
  uuid,uuid,uuid,uuid,text,uuid) to service_role;

commit;
