-- Synthetic prerequisite for the two-session claim test.
insert into public.school_agent_review_receipts
  (id, family_id, proposal_id, source_id, source_revision, decision,
   reviewed_by_auth_id, confirmed_title, confirmed_student_id,
   confirmed_due_date)
values ('00000000-0000-0000-0000-000000000031', 'family-a',
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000011', repeat('a',64),
        'approved', '00000000-0000-0000-0000-000000000001',
        'Synthetic worksheet', 'student-a', current_date);
