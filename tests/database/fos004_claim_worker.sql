begin;
-- A single statement ties the durable unique claim to a synthetic assignment.
-- One session may wait for the other's unique-index decision.
with claim as (
  insert into public.school_agent_action_claims
    (family_id, source_id, proposal_id, approved_receipt_id,
     action_kind, idempotency_digest)
  values ('family-a', '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000021',
          '00000000-0000-0000-0000-000000000031',
          'create_schoolwork_assignment', repeat('b',64))
  on conflict do nothing
  returning id, family_id
)
insert into public.assignments (id, family_id, student_id, title, due_date)
select id::text, family_id, 'student-a', 'Synthetic worksheet', current_date
from claim;
select pg_sleep(1);
commit;
