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
  then
    raise exception 'FOS-006 requires the reviewed UUID family_os workspace';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'family_os' and c.relname in (
      'family_sources', 'family_action_proposals',
      'school_agent_source_consents', 'school_agent_review_receipts',
      'school_agent_action_claims')
  ) then
    raise exception 'FOS-006 target already exists; reconcile before applying';
  end if;
end $$;

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
  foreign key (family_id, source_id, source_ref_digest)
    references family_os.family_sources(family_id, id, source_ref_digest) on delete cascade,
  foreign key (family_id, student_id)
    references family_os.students(family_id, id) on delete restrict
);

create table family_os.school_agent_source_consents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  source_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','active','revoked')),
  authorized_by_auth_id uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
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

create table family_os.school_agent_review_receipts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  proposal_id uuid not null,
  source_id uuid not null,
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in
    ('approved','rejected','needs_correction','withdrawn')),
  reviewed_by_auth_id uuid references auth.users(id) on delete set null,
  confirmed_title text,
  confirmed_student_id text,
  confirmed_due_date date,
  reviewed_at timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, id, proposal_id, source_id),
  unique (family_id, id, proposal_id, source_id, decision),
  foreign key (family_id, proposal_id, source_id, source_revision)
    references family_os.family_action_proposals(family_id, id, source_id, source_revision)
    on delete cascade,
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
  action_kind text not null check (action_kind = 'create_schoolwork_assignment'),
  idempotency_digest text not null check (idempotency_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'claimed' check (status in ('claimed','executed')),
  assignment_id text,
  executed_by_auth_id uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, source_id, action_kind),
  unique (family_id, proposal_id, action_kind),
  unique (family_id, idempotency_digest),
  foreign key (family_id, source_id)
    references family_os.family_sources(family_id, id) on delete cascade,
  foreign key (family_id, proposal_id)
    references family_os.family_action_proposals(family_id, id) on delete cascade,
  foreign key (family_id, approved_receipt_id, proposal_id, source_id, approval_decision)
    references family_os.school_agent_review_receipts
      (family_id, id, proposal_id, source_id, decision),
  check (status <> 'executed' or
    (assignment_id is not null and executed_by_auth_id is not null
      and executed_at is not null))
);

-- RLS remains fail-closed: no client policies. Also revoke table grants in
-- case project default privileges grant them to API roles.
alter table family_os.family_sources enable row level security;
alter table family_os.family_action_proposals enable row level security;
alter table family_os.school_agent_source_consents enable row level security;
alter table family_os.school_agent_review_receipts enable row level security;
alter table family_os.school_agent_action_claims enable row level security;
revoke all on family_os.family_sources, family_os.family_action_proposals,
  family_os.school_agent_source_consents, family_os.school_agent_review_receipts,
  family_os.school_agent_action_claims from public, anon, authenticated;
grant select, insert, update, delete on family_os.family_sources,
  family_os.family_action_proposals, family_os.school_agent_source_consents,
  family_os.school_agent_review_receipts, family_os.school_agent_action_claims
  to service_role;

commit;
