-- Disposable-only proof that ordinary deletes cannot silently erase review
-- evidence. Run after the FOS-007 RPC test has written synthetic records.
begin;
do $$
declare
  v_family uuid := '00000000-0000-0000-0000-00000000000a';
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
  v_blocked boolean;
begin
  if current_database() <> 'fos_uuid_workspace'
    or not exists (select 1 from family_os.school_agent_execution_receipts
                   where family_id = v_family)
    or not exists (select 1 from family_os.school_agent_review_receipts
                   where family_id = v_family and decision = 'approved')
  then raise exception 'Erasure rehearsal requires the synthetic executed family'; end if;
  if (select count(*) from pg_constraint
      where conrelid in (
        'family_os.school_agent_source_consents'::regclass,
        'family_os.school_agent_review_receipts'::regclass,
        'family_os.school_agent_action_claims'::regclass,
        'family_os.school_agent_execution_receipts'::regclass)
        and confrelid = 'auth.users'::regclass and confdeltype = 'r') <> 4
  then raise exception 'Auth user restriction shape changed'; end if;

  v_blocked := false;
  begin
    delete from family_os.family_action_proposals
    where family_id = v_family and status = 'executed';
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Executed proposal was deletable'; end if;

  v_blocked := false;
  begin
    delete from family_os.school_agent_action_claims
    where family_id = v_family and status = 'executed';
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Executed claim was deletable'; end if;

  v_blocked := false;
  begin
    delete from auth.users where id = v_actor;
  exception when foreign_key_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Referenced Auth user was deletable'; end if;

  if has_table_privilege('service_role',
    'family_os.school_agent_review_receipts', 'DELETE')
    or has_table_privilege('service_role',
    'family_os.school_agent_execution_receipts', 'DELETE')
  then raise exception 'Service role has receipt deletion privilege'; end if;
end $$;
rollback;
