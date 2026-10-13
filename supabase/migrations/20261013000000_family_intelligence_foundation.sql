-- Family OS — Family Intelligence Foundation (DRAFT)
-- Additive proposal only. NOT applied by this commit.
-- Prerequisite: the existing public.families table from src/lib/schema.sql.
-- WARNING: current profiles onboarding policy is permissive. Do not expose
-- client access or implement new RLS membership policies until that is fixed.
-- All new tables are locked down by RLS with NO client policies.
-- Apply first to a disposable Supabase database; do not assume deployed
-- schema matches the repository DDL.

create extension if not exists pgcrypto;

-- Shared cross-module identities. Legacy domain records remain authoritative.
create table if not exists public.family_entities (
  id                  uuid primary key default gen_random_uuid(),
  family_id           text not null references public.families(id) on delete cascade,
  kind                text not null check (kind in (
    'person', 'task', 'event', 'document', 'routine', 'routine_run',
    'observation', 'meal', 'shopping_item', 'expense', 'goal', 'other'
  )),
  label               text,
  legacy_module       text,
  legacy_id           text,
  sensitivity_class   text not null default 'normal'
                      check (sensitivity_class in ('normal', 'sensitive', 'restricted')),
  attributes          jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (family_id, id),
  constraint family_entities_legacy_ref_pair
    check ((legacy_module is null) = (legacy_id is null))
);

create unique index if not exists family_entities_legacy_ref_uidx
  on public.family_entities(family_id, legacy_module, legacy_id)
  where legacy_module is not null and legacy_id is not null;
create index if not exists family_entities_family_kind_idx
  on public.family_entities(family_id, kind);

-- Origin metadata only. Raw email/document/health bodies must not be copied here.
create table if not exists public.family_sources (
  id                  uuid primary key default gen_random_uuid(),
  family_id           text not null references public.families(id) on delete cascade,
  origin_kind         text not null check (origin_kind in (
    'manual', 'email', 'document', 'calendar', 'school_portal',
    'integration', 'agent', 'import', 'system'
  )),
  source_system       text not null default 'family_os',
  external_ref        text,
  label               text,
  content_hash        text,
  occurred_at         timestamptz,
  captured_at         timestamptz not null default now(),
  unique (family_id, id)
);

create unique index if not exists family_sources_external_ref_uidx
  on public.family_sources(family_id, source_system, external_ref)
  where external_ref is not null;
create index if not exists family_sources_family_captured_idx
  on public.family_sources(family_id, captured_at desc);

-- Edges are tenant-bound in BOTH directions through composite foreign keys.
create table if not exists public.family_entity_links (
  id                  uuid primary key default gen_random_uuid(),
  family_id           text not null references public.families(id) on delete cascade,
  from_entity_id      uuid not null,
  to_entity_id        uuid not null,
  relationship        text not null,
  source_id           uuid,
  confidence          numeric(4,3) check (confidence between 0 and 1),
  verified_by         text,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (family_id, id),
  constraint family_links_from_tenant_fk foreign key (family_id, from_entity_id)
    references public.family_entities(family_id, id) on delete cascade,
  constraint family_links_to_tenant_fk foreign key (family_id, to_entity_id)
    references public.family_entities(family_id, id) on delete cascade,
  constraint family_links_source_tenant_fk foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete set null (source_id)
);

create index if not exists family_links_outgoing_idx
  on public.family_entity_links(family_id, from_entity_id, relationship);
create index if not exists family_links_incoming_idx
  on public.family_entity_links(family_id, to_entity_id, relationship);

-- Append-only during normal operation: corrections are new events, not UPDATE.
-- Explicit privileged hard-deletion remains possible for family data erasure.
create table if not exists public.family_activity_events (
  id                  uuid primary key default gen_random_uuid(),
  family_id           text not null references public.families(id) on delete cascade,
  subject_entity_id   uuid,
  source_id           uuid,
  event_kind          text not null,
  actor_kind          text not null check (actor_kind in ('human', 'agent', 'system', 'integration')),
  actor_ref           text,
  occurred_at         timestamptz not null,
  recorded_at         timestamptz not null default now(),
  idempotency_key     text,
  sensitivity_class   text not null default 'normal'
                      check (sensitivity_class in ('normal', 'sensitive', 'restricted')),
  payload             jsonb not null default '{}'::jsonb,
  unique (family_id, id),
  constraint family_events_subject_tenant_fk foreign key (family_id, subject_entity_id)
    references public.family_entities(family_id, id) on delete set null (subject_entity_id),
  constraint family_events_source_tenant_fk foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete set null (source_id)
);

create unique index if not exists family_events_idempotency_uidx
  on public.family_activity_events(family_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists family_events_timeline_idx
  on public.family_activity_events(family_id, occurred_at desc, recorded_at desc);
create index if not exists family_events_subject_idx
  on public.family_activity_events(family_id, subject_entity_id, occurred_at desc);

create or replace function public.family_intelligence_prevent_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Family activity events cannot be updated. Record a correction event instead.';
end;
$$;

drop trigger if exists family_activity_events_no_mutation on public.family_activity_events;
create trigger family_activity_events_no_mutation
before update on public.family_activity_events
for each row execute function public.family_intelligence_prevent_event_mutation();

-- Observation is distinct from diagnosis or inferred causal explanation.
-- Subject/source/event links are tenant-bound. Collection requires opt-in.
create table if not exists public.family_observations (
  id                  uuid primary key default gen_random_uuid(),
  family_id           text not null references public.families(id) on delete cascade,
  subject_entity_id   uuid,
  event_id            uuid,
  source_id           uuid,
  observation_kind    text not null check (observation_kind in (
    'friction', 'routine_outcome', 'preference_signal', 'support_strategy',
    'workload_signal', 'meal_feedback', 'other'
  )),
  reported_by_kind    text not null check (reported_by_kind in ('human', 'agent', 'integration')),
  summary             text not null,
  context             jsonb not null default '{}'::jsonb,
  intensity           smallint check (intensity between 0 and 5),
  confidence          numeric(4,3) check (confidence between 0 and 1),
  sensitivity_class   text not null default 'sensitive'
                      check (sensitivity_class in ('normal', 'sensitive', 'restricted')),
  observed_at         timestamptz not null,
  recorded_at         timestamptz not null default now(),
  unique (family_id, id),
  constraint family_observations_subject_tenant_fk foreign key (family_id, subject_entity_id)
    references public.family_entities(family_id, id) on delete set null (subject_entity_id),
  constraint family_observations_event_tenant_fk foreign key (family_id, event_id)
    references public.family_activity_events(family_id, id) on delete set null (event_id),
  constraint family_observations_source_tenant_fk foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete set null (source_id)
);

create index if not exists family_observations_timeline_idx
  on public.family_observations(family_id, observed_at desc, observation_kind);

-- Approval intents only. No triggers execute external actions or modify domain
-- tables when proposal state changes. The future trusted gateway must validate
-- member authority, scope, approval, expiry, idempotency, and current state.
create table if not exists public.family_action_proposals (
  id                  uuid primary key default gen_random_uuid(),
  family_id           text not null references public.families(id) on delete cascade,
  target_entity_id    uuid,
  source_id           uuid,
  action_kind         text not null,
  proposal_payload    jsonb not null default '{}'::jsonb,
  rationale           text,
  created_by_kind     text not null check (created_by_kind in ('human', 'agent', 'system')),
  created_by_ref      text,
  confidence          numeric(4,3) check (confidence between 0 and 1),
  risk_class          text not null default 'needs_review'
                      check (risk_class in ('low', 'needs_review', 'high', 'restricted')),
  status              text not null default 'draft'
                      check (status in (
                        'draft', 'awaiting_approval', 'approved', 'rejected',
                        'executing', 'executed', 'failed', 'cancelled'
                      )),
  approved_by_ref     text,
  approved_at         timestamptz,
  executed_at         timestamptz,
  idempotency_key     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (family_id, id),
  constraint family_proposals_target_tenant_fk foreign key (family_id, target_entity_id)
    references public.family_entities(family_id, id) on delete set null (target_entity_id),
  constraint family_proposals_source_tenant_fk foreign key (family_id, source_id)
    references public.family_sources(family_id, id) on delete set null (source_id)
);

create unique index if not exists family_proposals_idempotency_uidx
  on public.family_action_proposals(family_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists family_proposals_queue_idx
  on public.family_action_proposals(family_id, status, created_at desc);

-- CRITICAL: NO policies are intentionally created. No anon/authenticated
-- direct SELECT/INSERT/UPDATE/DELETE access. A future SECURE, TESTED server
-- gateway will manage access. Service-role bypass must never reach the browser.
alter table public.family_entities enable row level security;
alter table public.family_sources enable row level security;
alter table public.family_entity_links enable row level security;
alter table public.family_activity_events enable row level security;
alter table public.family_observations enable row level security;
alter table public.family_action_proposals enable row level security;

comment on table public.family_entities is
  'Shared entity references; preserve legacy domain tables. RLS locked until reviewed.';
comment on table public.family_activity_events is
  'Append-only household event facts; corrections must be appended.';
comment on table public.family_action_proposals is
  'Inert action intents; execution only through a future authorized gateway.';
