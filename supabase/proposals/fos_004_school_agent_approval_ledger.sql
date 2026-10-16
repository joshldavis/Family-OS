-- FOS-004 — SCHOOL AGENT APPROVAL LEDGER (REVIEW PROPOSAL ONLY)
-- !!! NEVER RUN AGAINST PRODUCTION WITHOUT FOS-SEC-001 AUTH CUTOVER !!!
--
-- Dependencies:
--   1) reviewed security proposal (profiles/families lockdown);
--   2) FOS-INT-001 family_sources + family_action_proposals foundation;
--   3) public.students and public.assignments as actually verified in DB.
--
-- These CREATE statements are NOT a migration and are NOT applied.
-- This proposal is stored under supabase/proposals/ intentionally.
-- Apply only to a disposable/non-production instance AFTER schema review.
-- Do not create client RLS policies. No frontend or public Data API grants.
-- A trusted server-side executor must use a single SERIALIZABLE transaction,
-- lock source, consent, membership and proposal, and perform one idempotent
-- assignment insert plus immutable receipt. These tables DO NOT auto-execute.
--
-- A service role bypasses RLS. Never expose its credentials to the client.
-- This schema assumes FOS-INT-001 source IDs and action proposal IDs are UUID.
-- Legacy families and students use text IDs. Do not coerce IDs in the API.

begin;

create extension if not exists pgcrypto;

-- Tenant-bound composite FKs below need uniqueness on the source tables.
-- Both legacy tables have globally unique IDs, but these indexes make the
-- household join a database-enforced condition, not only app validation.
create unique index if not exists students_family_id_id_uidx
  on public.students(family_id, id);
create unique index if not exists family_proposals_family_id_source_uidx
  on public.family_action_proposals(family_id, id, source_id);

-- Per-source consent, not a broad claim that a school email is authentic.
-- Revoking consent must block future execution, including during retries.
create table if not exists public.school_agent_source_consents (
  id                    uuid primary key default gen_random_uuid(),
  family_id             text not null references public.families(id) on delete cascade,
  source_id             uuid not null,
  status                text not null default 'pending'
                        check (status in ('pending','active','revoked')),
  authorized_by_auth_id uuid references auth.users(id) on delete set null,
  granted_at            timestamptz,
  revoked_at            timestamptz,
  updated_at            timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, source_id),
  constraint school_consent_source_same_family
    foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete cascade,
  constraint school_consent_status_dates
    check (
      (status = 'active' and granted_at is not null and revoked_at is null
        and authorized_by_auth_id is not null)
      or (status = 'revoked' and revoked_at is not null)
      or (status = 'pending' and granted_at is null and revoked_at is null)
    )
);

create index if not exists school_consent_family_status_idx
  on public.school_agent_source_consents(family_id, status);

-- Immutable decisions: new record for each correction/approval/rejection.
-- In a trusted transaction, an approved row must contain the EXACT fields
-- the parent confirmed; the server recomputes a canonical source revision.
-- Do not expose note text, raw message body, or unverified child names.
create table if not exists public.school_agent_review_receipts (
  id                    uuid primary key default gen_random_uuid(),
  family_id             text not null references public.families(id) on delete cascade,
  proposal_id           uuid not null,
  source_id             uuid not null,
  source_revision       text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  decision              text not null check (decision in
                        ('approved','rejected','needs_correction','withdrawn')),
  reviewed_by_auth_id   uuid references auth.users(id) on delete set null,
  confirmed_title       text,
  confirmed_student_id  text,
  confirmed_due_date    date,
  reviewed_at           timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, id, proposal_id, source_id),
  constraint school_review_proposal_source_same_family
    foreign key (family_id, proposal_id, source_id)
    references public.family_action_proposals(family_id, id, source_id) on delete cascade,
  constraint school_review_source_same_family
    foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete cascade,
  constraint school_review_student_same_family
    foreign key (family_id, confirmed_student_id)
    references public.students(family_id, id) on delete restrict,
  constraint school_review_valid_title
    check (confirmed_title is null or
      (length(confirmed_title) between 1 and 200 and
        confirmed_title !~ '[[:cntrl:]]')),
  constraint school_review_approved_complete
    check (decision <> 'approved' or
      (reviewed_by_auth_id is not null and confirmed_title is not null
       and confirmed_student_id is not null and confirmed_due_date is not null))
);

create index if not exists school_review_family_proposal_idx
  on public.school_agent_review_receipts(family_id, proposal_id, reviewed_at desc);

-- A single durable claim per (household, actual source, intended action).
-- The executor must INSERT this claim, assignment and execution receipt
-- atomically. ON CONFLICT must return existing result, never create a second
-- assignment. A failed transaction rolls back claim + assignment together.
create table if not exists public.school_agent_action_claims (
  id                    uuid primary key default gen_random_uuid(),
  family_id             text not null references public.families(id) on delete cascade,
  source_id             uuid not null,
  proposal_id           uuid not null,
  approved_receipt_id   uuid not null,
  action_kind           text not null
                        check (action_kind = 'create_schoolwork_assignment'),
  idempotency_digest    text not null check (idempotency_digest ~ '^[0-9a-f]{64}$'),
  status                text not null default 'claimed'
                        check (status in ('claimed','executed')),
  assignment_id         text,
  executed_by_auth_id   uuid references auth.users(id) on delete set null,
  executed_at           timestamptz,
  created_at            timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, source_id, action_kind),
  unique (family_id, proposal_id, action_kind),
  unique (family_id, idempotency_digest),
  constraint school_claim_source_same_family
    foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete cascade,
  constraint school_claim_proposal_same_family
    foreign key (family_id, proposal_id)
    references public.family_action_proposals(family_id, id) on delete cascade,
  constraint school_claim_receipt_same_proposal_source_family
    foreign key (family_id, approved_receipt_id, proposal_id, source_id)
    references public.school_agent_review_receipts(family_id, id, proposal_id, source_id),
  constraint school_claim_executed_complete
    check (status <> 'executed' or
      (assignment_id is not null and executed_by_auth_id is not null
       and executed_at is not null))
);

create index if not exists school_claim_family_status_idx
  on public.school_agent_action_claims(family_id, status, created_at desc);

-- Approved review rows use ON DELETE RESTRICT for student references so
-- deletion cannot silently orphan a claimed action. Real erasure must have
-- a privileged, reviewed workflow for revocation and dependent receipts.
--
-- Optional assignment-id reference requires a reviewed composite unique
-- constraint on legacy assignments(family_id,id). This proposal does NOT
-- alter the existing assignments table or make such assumptions silently.

-- Fail-closed, including if public is exposed in PostgREST.
alter table public.school_agent_source_consents enable row level security;
alter table public.school_agent_review_receipts enable row level security;
alter table public.school_agent_action_claims enable row level security;

revoke all on table public.school_agent_source_consents from public, anon, authenticated;
revoke all on table public.school_agent_review_receipts from public, anon, authenticated;
revoke all on table public.school_agent_action_claims from public, anon, authenticated;

comment on table public.school_agent_source_consents is
  'Source-level consent ledger; no client access and no implied sender authenticity.';
comment on table public.school_agent_review_receipts is
  'Append-only parent review evidence, not itself an action executor.';
comment on table public.school_agent_action_claims is
  'Unique source/action claim; only a fully reviewed trusted transaction may execute.';

commit;
