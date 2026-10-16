-- Assertions run only on synthetic data in a disposable PostgreSQL service.
-- The proposal and audit are invoked separately with psql ON_ERROR_STOP.
begin;

do $verify$
declare
  relation_name text;
  table_oid oid;
begin
  foreach relation_name in array array[
    'school_agent_source_consents',
    'school_agent_review_receipts',
    'school_agent_action_claims'
  ] loop
    table_oid := to_regclass(format('public.%I', relation_name));
    if table_oid is null then raise exception 'missing %', relation_name; end if;
    if not (select relrowsecurity from pg_class where oid = table_oid) then
      raise exception 'RLS disabled on %', relation_name;
    end if;
    if has_table_privilege('anon', table_oid, 'SELECT, INSERT, UPDATE, DELETE')
       or has_table_privilege('authenticated', table_oid,
                              'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'client privilege on %', relation_name;
    end if;
  end loop;
end
$verify$;

insert into public.school_agent_source_consents
  (family_id, source_id, status, authorized_by_auth_id, granted_at)
values ('family-a', '00000000-0000-0000-0000-000000000011', 'active',
        '00000000-0000-0000-0000-000000000001', now());

insert into public.school_agent_review_receipts
  (id, family_id, proposal_id, source_id, source_revision, decision,
   reviewed_by_auth_id, confirmed_title, confirmed_student_id,
   confirmed_due_date)
values ('00000000-0000-0000-0000-000000000031', 'family-a',
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000011', repeat('a',64),
        'approved', '00000000-0000-0000-0000-000000000001',
        'Synthetic worksheet', 'student-a', current_date);

insert into public.school_agent_action_claims
  (family_id, source_id, proposal_id, approved_receipt_id,
   action_kind, idempotency_digest)
values ('family-a', '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000031',
        'create_schoolwork_assignment', repeat('b',64));

do $negative$
declare
  rejected boolean;
begin
  rejected := false;
  begin
    insert into public.school_agent_source_consents (family_id, source_id)
    values ('family-a', '00000000-0000-0000-0000-000000000012');
  exception when foreign_key_violation then rejected := true;
  end;
  if not rejected then raise exception 'cross-family source accepted'; end if;

  rejected := false;
  begin
    insert into public.school_agent_review_receipts
      (family_id, proposal_id, source_id, source_revision, decision,
       confirmed_student_id)
    values ('family-a', '00000000-0000-0000-0000-000000000021',
            '00000000-0000-0000-0000-000000000011', repeat('a',64),
            'rejected', 'student-b');
  exception when foreign_key_violation then rejected := true;
  end;
  if not rejected then raise exception 'cross-family student accepted'; end if;

  rejected := false;
  begin
    insert into public.school_agent_action_claims
      (family_id, source_id, proposal_id, approved_receipt_id,
       action_kind, idempotency_digest)
    values ('family-a', '00000000-0000-0000-0000-000000000011',
            '00000000-0000-0000-0000-000000000021',
            '00000000-0000-0000-0000-000000000031',
            'create_schoolwork_assignment', repeat('c',64));
  exception when unique_violation then rejected := true;
  end;
  if not rejected then raise exception 'duplicate action accepted'; end if;

  rejected := false;
  begin
    insert into public.school_agent_review_receipts
      (family_id, proposal_id, source_id, source_revision, decision)
    values ('family-a', '00000000-0000-0000-0000-000000000021',
            '00000000-0000-0000-0000-000000000011', repeat('a',64),
            'approved');
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'incomplete approval accepted'; end if;
end
$negative$;

rollback;
