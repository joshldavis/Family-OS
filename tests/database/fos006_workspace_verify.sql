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
       'school_agent_review_receipts','school_agent_action_claims')
      and (not c.relrowsecurity or not has_table_privilege('service_role',c.oid,'SELECT')
        or not has_table_privilege('service_role',c.oid,'INSERT')
        or has_table_privilege('authenticated',c.oid,'SELECT')
        or has_table_privilege('authenticated',c.oid,'INSERT')
        or has_table_privilege('anon',c.oid,'SELECT'))
  ) then raise exception 'FOS-006 browser access is open'; end if;

  insert into family_os.family_sources(id,family_id,origin_kind) values
    (source_a,a,'school_portal'),(source_b,b,'school_portal');
  insert into family_os.family_action_proposals(id,family_id,source_id,action_kind)
    values (proposal_a,a,source_a,'create_schoolwork_assignment');

  blocked := false;
  begin
    insert into family_os.family_action_proposals(family_id,source_id,action_kind)
      values (a,source_b,'create_schoolwork_assignment');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'cross-family source accepted'; end if;

  blocked := false;
  begin
    insert into family_os.school_agent_review_receipts
      (family_id,proposal_id,source_id,source_revision,decision)
      values (a,proposal_a,source_a,repeat('a',64),'approved');
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'incomplete approval accepted'; end if;

  insert into family_os.school_agent_review_receipts
    (id,family_id,proposal_id,source_id,source_revision,decision,
     reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
    values (receipt_a,a,proposal_a,source_a,repeat('a',64),'approved',
      '00000000-0000-0000-0000-000000000001','Math','student-a','2026-10-20');

  blocked := false;
  begin
    insert into family_os.school_agent_review_receipts
      (family_id,proposal_id,source_id,source_revision,decision,
       reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
      values (a,proposal_a,source_a,repeat('b',64),'approved',
       '00000000-0000-0000-0000-000000000001','Math','student-b','2026-10-20');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'cross-family student accepted'; end if;

  insert into family_os.school_agent_action_claims
    (family_id,source_id,proposal_id,approved_receipt_id,action_kind,idempotency_digest)
    values (a,source_a,proposal_a,receipt_a,'create_schoolwork_assignment',repeat('c',64));
  blocked := false;
  begin
    insert into family_os.school_agent_action_claims
      (family_id,source_id,proposal_id,approved_receipt_id,action_kind,idempotency_digest)
      values (a,source_a,proposal_a,receipt_a,'create_schoolwork_assignment',repeat('d',64));
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'duplicate source claim accepted'; end if;
end $$;
