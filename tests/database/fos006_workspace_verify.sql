-- All rows here are synthetic and this file runs only in ephemeral CI Postgres.
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  source_a uuid := '00000000-0000-0000-0000-000000000011';
  source_b uuid := '00000000-0000-0000-0000-000000000012';
  proposal_a uuid := '00000000-0000-0000-0000-000000000021';
  receipt_a uuid := '00000000-0000-0000-0000-000000000031';
  blocked boolean;
begin
  if has_table_privilege('service_role','auth.sessions','SELECT')
    or has_function_privilege('authenticated',
      'family_os.school_agent_session_active(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon',
      'family_os.school_agent_session_active(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role',
      'family_os.school_agent_session_active(uuid,uuid)','EXECUTE')
  then raise exception 'session helper privileges are unsafe'; end if;
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname in
      ('family_sources','family_action_proposals','school_agent_action_claims')
  ) then raise exception 'FOS-006 wrote public tables'; end if;
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='family_os' and c.relname in
      ('family_sources','family_action_proposals','school_agent_source_consents',
       'school_agent_review_receipts','school_agent_action_claims',
       'school_agent_execution_receipts')
      and (not c.relrowsecurity or not has_table_privilege('service_role',c.oid,'SELECT')
        or not has_table_privilege('service_role',c.oid,'INSERT')
        or has_table_privilege('authenticated',c.oid,'SELECT')
        or has_table_privilege('authenticated',c.oid,'INSERT')
        or has_table_privilege('anon',c.oid,'SELECT'))
  ) then raise exception 'FOS-006 browser access is open'; end if;
  if has_table_privilege('service_role',
      'family_os.school_agent_review_receipts','UPDATE')
    or has_table_privilege('service_role',
      'family_os.school_agent_review_receipts','DELETE')
  then raise exception 'review receipts are mutable by service_role'; end if;
  if has_table_privilege('service_role',
      'family_os.school_agent_source_consents','DELETE')
  then raise exception 'service_role can delete consent history'; end if;

  insert into family_os.family_sources(id,family_id,origin_kind,source_system,source_ref_digest) values
    (source_a,a,'email','school_email',repeat('a',64)),
    (source_b,b,'email','school_email',repeat('b',64));
  insert into family_os.family_action_proposals
    (id,family_id,source_id,source_ref_digest,source_revision,action_kind,
     student_id,title,due_date,consent_captured_at,
     title_confirmed_by_parent,student_confirmed_by_parent,date_confirmed_by_parent)
    values (proposal_a,a,source_a,repeat('a',64),repeat('c',64),
      'create_schoolwork_assignment','student-a','Math','2026-10-20',now(),true,true,true);

  blocked := false;
  begin
    insert into family_os.family_action_proposals
      (family_id,source_id,source_ref_digest,source_revision,action_kind,
       student_id,title,due_date)
      values (a,source_b,repeat('b',64),repeat('c',64),
        'create_schoolwork_assignment','student-a','Math','2026-10-20');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'cross-family source accepted'; end if;

  blocked := false;
  begin
    insert into family_os.family_action_proposals
      (family_id,source_id,source_ref_digest,source_revision,action_kind,
       student_id,title,due_date)
      values (a,source_a,repeat('b',64),repeat('c',64),
        'create_schoolwork_assignment','student-a','Math','2026-10-20');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'source digest mismatch accepted'; end if;

  blocked := false;
  begin
    insert into family_os.school_agent_review_receipts
      (family_id,proposal_id,source_id,source_revision,
       consent_grant_version,decision)
      values (a,proposal_a,source_a,repeat('c',64),1,'approved');
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'incomplete approval accepted'; end if;

  blocked := false;
  begin
    insert into family_os.school_agent_review_receipts
      (family_id,proposal_id,source_id,source_revision,
       consent_grant_version,decision)
      values (a,proposal_a,source_a,repeat('d',64),1,'rejected');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'stale source revision accepted'; end if;

  blocked := false;
  begin
    insert into family_os.school_agent_review_receipts
      (family_id,proposal_id,source_id,source_revision,
       consent_grant_version,decision)
      values (a,proposal_a,source_a,repeat('c',64),2,'rejected');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'review consent version mismatch accepted'; end if;

  insert into family_os.school_agent_review_receipts
    (id,family_id,proposal_id,source_id,source_revision,consent_grant_version,decision,
     reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
    values (receipt_a,a,proposal_a,source_a,repeat('c',64),1,'approved',
      '00000000-0000-0000-0000-000000000001','Math','student-a','2026-10-20');

  blocked := false;
  begin
    insert into family_os.school_agent_review_receipts
      (family_id,proposal_id,source_id,source_revision,consent_grant_version,decision,
       reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
      values (a,proposal_a,source_a,repeat('c',64),1,'approved',
       '00000000-0000-0000-0000-000000000001','Math','student-b','2026-10-20');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'cross-family student accepted'; end if;

  insert into family_os.school_agent_review_receipts
    (family_id,proposal_id,source_id,source_revision,consent_grant_version,decision)
    values (a,proposal_a,source_a,repeat('c',64),1,'rejected');
  blocked := false;
  begin
    insert into family_os.school_agent_action_claims
      (family_id,source_id,proposal_id,approved_receipt_id,source_revision,
       action_kind,idempotency_digest)
      select a,source_a,proposal_a,id,repeat('c',64),
        'create_schoolwork_assignment',repeat('e',64)
      from family_os.school_agent_review_receipts where decision='rejected';
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'rejected review was claimed'; end if;

  insert into family_os.school_agent_action_claims
    (family_id,source_id,proposal_id,approved_receipt_id,source_revision,
     action_kind,idempotency_digest)
    values (a,source_a,proposal_a,receipt_a,repeat('c',64),
      'create_schoolwork_assignment',repeat('c',64));
  blocked := false;
  begin
    insert into family_os.school_agent_action_claims
      (family_id,source_id,proposal_id,approved_receipt_id,source_revision,
       action_kind,idempotency_digest)
      values (a,source_a,proposal_a,receipt_a,repeat('c',64),
        'create_schoolwork_assignment',repeat('d',64));
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'duplicate source claim accepted'; end if;
end $$;
