-- REVIEW PROPOSAL ONLY. Exercise solely in disposable PostgreSQL.
-- This is a UUID/family_os adaptation of the PR #2 source/proposal subset and
-- PR #16 approval ledger. It is not a migration and creates no execution API.
-- Never run against made-again until the full cutover and Auth/RLS review.
begin;

do $$
begin
  if to_regclass('family_os.students') is null
    or to_regclass('family_os.assignments') is null
    or to_regclass('public.households') is null
    or to_regclass('public.profiles') is null
    or exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = 'family_os.students'::regclass
        and a.attname = 'family_id' and not a.attisdropped
        and a.atttypid <> 'uuid'::regtype
    )
    or not exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = 'family_os.students'::regclass
        and a.attname = 'family_id' and not a.attisdropped
        and a.atttypid = 'uuid'::regtype
    )
    or not exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = 'family_os.assignments'::regclass
        and a.attname = 'family_id' and not a.attisdropped
        and a.atttypid = 'uuid'::regtype
    )
    or not exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = 'family_os.students'::regclass and c.relrowsecurity
    )
    or not exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = 'family_os.assignments'::regclass and c.relrowsecurity
    )
    or to_regprocedure('family_os.current_family_id()') is null
    or to_regprocedure('family_os.current_owner_family_id()') is null
    or to_regclass('auth.sessions') is null
  then
    raise exception 'FOS-006 requires the reviewed UUID family_os workspace';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'family_os' and c.relname in (
      'family_sources', 'family_action_proposals',
      'school_agent_source_consents', 'school_agent_review_receipts',
      'school_agent_action_claims', 'school_agent_execution_receipts',
      'school_agent_erasure_marks')
  ) then
    raise exception 'FOS-006 target already exists; reconcile before applying';
  end if;
end $$;

-- A tenant-bound execution receipt must reference the actual assignment.
-- This index is on an existing Family OS table and therefore requires a
-- separate migration review and maintenance plan before any live rollout.
create unique index family_os_assignments_family_id_id_uidx
  on family_os.assignments(family_id, id);

-- The service role cannot SELECT auth.sessions in the shared project. This
-- read-only helper is owned by the migration owner and reveals one boolean,
-- never a session row. The caller must first verify the signed bearer with
-- Supabase Auth and extract that exact token's session_id; user/session IDs
-- supplied directly by the browser are never sufficient authorization.
create function family_os.school_agent_session_active(
  p_user_id uuid, p_session_id uuid
) returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = p_session_id and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now())
    for share
  )
$$;
revoke all on function family_os.school_agent_session_active(uuid, uuid)
  from public, anon, authenticated;
grant execute on function family_os.school_agent_session_active(uuid, uuid)
  to service_role;

-- Metadata only. Raw school messages and documents belong in a separate,
-- consented storage design. Direct browser access is denied.
create table family_os.family_sources (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  origin_kind text not null check (origin_kind in
    ('manual','email','document','calendar','school_portal','integration','agent','import','system')),
  source_system text not null default 'family_os',
  external_ref text,
  source_ref_digest text check (source_ref_digest ~ '^[0-9a-f]{64}$'),
  content_hash text,
  captured_at timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, id, source_ref_digest)
);
create unique index family_os_sources_external_ref_uidx
  on family_os.family_sources(family_id, source_system, external_ref)
  where external_ref is not null;

-- A short-lived deletion fence. It is removed when the household itself is
-- erased; it contains no school content or child identifier.
create table family_os.school_agent_erasure_marks (
  family_id uuid primary key references public.households(id) on delete cascade,
  started_at timestamptz not null default now()
);

create table family_os.family_action_proposals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  source_id uuid not null,
  source_ref_digest text not null check (source_ref_digest ~ '^[0-9a-f]{64}$'),
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  action_kind text not null check (action_kind = 'create_schoolwork_assignment'),
  student_id text not null,
  title text not null check (length(title) between 1 and 200
    and title !~ '[[:cntrl:]]'),
  due_date date not null,
  consent_captured_at timestamptz,
  consent_grant_version bigint not null default 1 check (consent_grant_version > 0),
  title_confirmed_by_parent boolean not null default false,
  student_confirmed_by_parent boolean not null default false,
  date_confirmed_by_parent boolean not null default false,
  status text not null default 'awaiting_approval' check (status in
    ('awaiting_approval','approved','rejected','executing','executed','cancelled')),
  created_at timestamptz not null default now(),
  check (status not in ('approved','executing','executed') or
    (consent_captured_at is not null and title_confirmed_by_parent
      and student_confirmed_by_parent and date_confirmed_by_parent)),
  unique (family_id, id),
  unique (family_id, id, source_id),
  unique (family_id, id, source_id, source_revision),
  unique (family_id, id, source_id, source_revision, consent_grant_version),
  unique (family_id, id, source_revision),
  foreign key (family_id, source_id, source_ref_digest)
    references family_os.family_sources(family_id, id, source_ref_digest) on delete cascade,
  foreign key (family_id, student_id)
    references family_os.students(family_id, id) on delete restrict
);

-- Once a proposal is approved, its evidence cannot be rewritten to match a
-- later consent grant. The execution adapter makes the sole allowed status
-- transition from approved to executed.
create function family_os.school_agent_guard_approved_proposal()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved','executing','executed') then
      if current_user <> 'postgres' or
        current_setting('family_os.erasing_family', true) is distinct from
          old.family_id::text then
        raise exception 'Reviewed proposal is immutable';
      end if;
    end if;
    return old;
  end if;
  if old.status in ('approved','executing','executed') then
    if old.status <> 'approved' or new.status not in ('approved','executed')
      or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'Reviewed proposal is immutable';
    end if;
  end if;
  return new;
end $$;
revoke all on function family_os.school_agent_guard_approved_proposal()
  from public, anon, authenticated;
create trigger school_agent_approved_proposal_guard
  before update or delete on family_os.family_action_proposals
  for each row execute function family_os.school_agent_guard_approved_proposal();

create table family_os.school_agent_source_consents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  source_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','active','revoked')),
  authorized_by_auth_id uuid references auth.users(id) on delete restrict,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  grant_version bigint not null default 1 check (grant_version > 0),
  unique (family_id, id),
  unique (family_id, source_id),
  foreign key (family_id, source_id)
    references family_os.family_sources(family_id, id) on delete cascade,
  check (
    (status = 'active' and granted_at is not null and revoked_at is null
      and authorized_by_auth_id is not null)
    or (status = 'revoked' and revoked_at is not null)
    or (status = 'pending' and granted_at is null and revoked_at is null)
  )
);

-- Any revocation or regrant advances the epoch. Old proposal approvals remain
-- bound to their captured epoch and cannot become valid again on reactivation.
create function family_os.school_agent_bump_consent_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status is distinct from old.status
    or new.granted_at is distinct from old.granted_at
    or new.revoked_at is distinct from old.revoked_at
    or new.authorized_by_auth_id is distinct from old.authorized_by_auth_id then
    new.grant_version := old.grant_version + 1;
  elsif new.grant_version is distinct from old.grant_version then
    raise exception 'Consent version is server managed';
  end if;
  return new;
end $$;
revoke all on function family_os.school_agent_bump_consent_version()
  from public, anon, authenticated;
create trigger school_agent_consent_version_before_update
  before update on family_os.school_agent_source_consents
  for each row execute function family_os.school_agent_bump_consent_version();

create table family_os.school_agent_review_receipts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  proposal_id uuid not null,
  source_id uuid not null,
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  consent_grant_version bigint not null check (consent_grant_version > 0),
  decision text not null check (decision in
    ('approved','rejected','needs_correction','withdrawn')),
  reviewed_by_auth_id uuid references auth.users(id) on delete restrict,
  confirmed_title text,
  confirmed_student_id text,
  confirmed_due_date date,
  reviewed_at timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, id, proposal_id, source_id),
  unique (family_id, id, proposal_id, source_id, decision),
  unique (family_id, id, proposal_id, source_id, decision, source_revision),
  foreign key (family_id, proposal_id, source_id, source_revision,
               consent_grant_version)
    references family_os.family_action_proposals
      (family_id, id, source_id, source_revision, consent_grant_version)
    on delete restrict,
  foreign key (family_id, confirmed_student_id)
    references family_os.students(family_id, id) on delete restrict,
  check (confirmed_title is null or
    (length(confirmed_title) between 1 and 200 and
      confirmed_title !~ '[[:cntrl:]]')),
  check (decision <> 'approved' or
    (reviewed_by_auth_id is not null and confirmed_title is not null
      and confirmed_student_id is not null and confirmed_due_date is not null))
);

create table family_os.school_agent_action_claims (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  source_id uuid not null,
  proposal_id uuid not null,
  approved_receipt_id uuid not null,
  approval_decision text not null default 'approved'
    check (approval_decision = 'approved'),
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  action_kind text not null check (action_kind = 'create_schoolwork_assignment'),
  idempotency_digest text not null check (idempotency_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'claimed' check (status in ('claimed','executed')),
  assignment_id text,
  executed_by_auth_id uuid references auth.users(id) on delete restrict,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, id, assignment_id, source_revision,
          executed_by_auth_id, status),
  unique (family_id, source_id, action_kind),
  unique (family_id, proposal_id, action_kind),
  unique (family_id, idempotency_digest),
  foreign key (family_id, source_id)
    references family_os.family_sources(family_id, id) on delete cascade,
  foreign key (family_id, proposal_id)
    references family_os.family_action_proposals(family_id, id) on delete cascade,
  foreign key (family_id, proposal_id, source_revision)
    references family_os.family_action_proposals(family_id, id, source_revision),
  foreign key (family_id, approved_receipt_id, proposal_id, source_id,
               approval_decision, source_revision)
    references family_os.school_agent_review_receipts
      (family_id, id, proposal_id, source_id, decision, source_revision),
  check (status <> 'executed' or
    (assignment_id is not null and executed_by_auth_id is not null
      and executed_at is not null))
);

create table family_os.school_agent_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  claim_id uuid not null,
  claim_status text not null default 'executed' check (claim_status = 'executed'),
  assignment_id text not null,
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  executed_at timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, claim_id),
  foreign key (family_id, claim_id, assignment_id, source_revision,
               actor_auth_user_id, claim_status)
    references family_os.school_agent_action_claims
      (family_id, id, assignment_id, source_revision, executed_by_auth_id,
       status),
  foreign key (family_id, assignment_id)
    references family_os.assignments(family_id, id)
);

-- A completed claim is an audit record. It cannot be moved back to claimed
-- or rewritten after the receipt has been inserted.
create function family_os.school_agent_guard_executed_claim()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'executed' then
    if tg_op <> 'DELETE' or current_user <> 'postgres' or
      current_setting('family_os.erasing_family', true) is distinct from
        old.family_id::text then
      raise exception 'Executed claim is immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function family_os.school_agent_guard_executed_claim()
  from public, anon, authenticated;
create trigger school_agent_executed_claim_guard
  before update or delete on family_os.school_agent_action_claims
  for each row execute function family_os.school_agent_guard_executed_claim();

-- RLS remains fail-closed: no client policies. Also revoke table grants in
-- case project default privileges grant them to API roles.
alter table family_os.family_sources enable row level security;
alter table family_os.family_action_proposals enable row level security;
alter table family_os.school_agent_source_consents enable row level security;
alter table family_os.school_agent_review_receipts enable row level security;
alter table family_os.school_agent_action_claims enable row level security;
alter table family_os.school_agent_execution_receipts enable row level security;
alter table family_os.school_agent_erasure_marks enable row level security;
revoke all on family_os.family_sources, family_os.family_action_proposals,
  family_os.school_agent_source_consents, family_os.school_agent_review_receipts,
  family_os.school_agent_action_claims, family_os.school_agent_execution_receipts
  from public, anon, authenticated;
revoke all on family_os.school_agent_erasure_marks
  from public, anon, authenticated, service_role;
grant select on family_os.school_agent_erasure_marks to service_role;
grant select, insert, update, delete on family_os.family_sources,
  family_os.family_action_proposals,
  family_os.school_agent_action_claims
  to service_role;
-- Default privileges in a shared schema can pre-grant deletion or truncation.
revoke all on family_os.school_agent_source_consents,
  family_os.school_agent_review_receipts,
  family_os.school_agent_execution_receipts from service_role;
grant select, insert, update on family_os.school_agent_source_consents
  to service_role;
grant select, insert on family_os.school_agent_review_receipts
  to service_role;
grant select, insert on family_os.school_agent_execution_receipts
  to service_role;

commit;
