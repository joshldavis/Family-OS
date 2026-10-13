# Family Intelligence Foundation — architecture and migration plan

Status: **DRAFT / NOT DEPLOYED**. Base audited: **joshldavis/Family-OS main at b2bfa6c (2026-05-16)**. Prepared 2026-10-13.

## Decision

Preserve the current React modules and their routes. Introduce a shared, household-scoped **intelligence data layer** underneath them. Supabase/Postgres will eventually become the canonical system of record for durable family information. Browser localStorage remains a temporary cache, offline draft store, and compatibility adapter until individual modules are migrated. No big-bang rewrite and no silent data deletion.

This document proposes a V1 architecture; it does **not** mean the migration has been deployed or the new system is operational.

**Integration with operating modes:** main also contains docs/LEARNING-SUPPORT-MODE-SPEC.md (proposed General Family / Learning Support / Custom modes). These are complementary: operating modes control which experiences and capabilities are enabled, while this intelligence layer is shared beneath every mode. Do not make mode switching duplicate household records or change their visibility without explicit permission. Mode-only work (FOS-001A) can proceed independently of the locked-down foundation tables; connecting sensitive data/agents requires the Phase 0 security gate.

## Audited reality in the current main branch

- Application stack: React 19, TypeScript, Vite, module registry and FamilyContext.
- Existing database DDL: **src/lib/schema.sql**. Tables include families, profiles, students, assignments, chores, events, transactions, budgets, savings_goals, daily_agendas.
- Existing Supabase sync: **src/services/supabaseSync.ts**, limited to a subset of modules.
- Other features stored in browser state/localStorage: recipes, meals, shopping lists, documents, rewards, pinboard, wellness/health, several email-intelligence lists, and some AI settings. See **src/App.tsx**.
- Existing AI: **src/services/ai.ts** for provider/model selection, AI scan, document-grounded coach, family briefings. **AIChatPanel** has a separate direct Gemini path. These are useful features, not a governed multi-agent executor.
- Email router extracts structured events, assignments and actions from pasted email; Gmail sync and Google Calendar service are still scaffolded/mock.
- Existing audit fields do not amount to an append-only event history.

### Correctness and security blockers before production rollout

1. **Membership authorization:** current policy on profiles permits insert WITH CHECK (true). Profile enrollment and household membership must be verified server-side before exposing new private read/write APIs. Current family-based policies inherit that risk.
2. **Schema drift:** the sync mapper writes transactions.source absent from checked-in SQL; students.notes is read but not present in checked-in SQL; assignment/chore completion actor and timestamps aren't persisted. Inspect the *actual deployed Supabase schema* before writing corrective migrations.
3. **Entity identity:** students and profiles are distinct identifiers and can refer to the same child. NEVER auto-merge them merely by name. An explicit reviewed identity mapping is required.
4. **Source provenance:** an email-derived event should retain the source message reference, extraction, uncertainty, and routing outcome. Current email routing can default ambiguous student matching to the first student; that is unsafe for automatic writes.
5. **Credential management:** current AI service supports provider keys in localStorage and browser-side requests. Introduce a server-side AI/tool gateway before production multi-household rollout.
6. **Private data:** do not put raw children's behavioral/medical records into searchable generic event payloads by default. Keep sensitive content segregated with explicit user consent and retention controls.

## Design: six additive foundation tables

**1. family_entities** — shared references for domain records (person, task, event, document, meal, routine, observation, etc.), with stable UUID identity and optional legacy module/ID reference. Does not replace the existing domain tables.

**2. family_entity_links** — typed relationships within one family (e.g. person -> assigned_to -> task, document -> generated -> task). Composite foreign keys prevent cross-family relationships.

**3. family_sources** — lightweight origin/provenance metadata (manual, upload, email, integration, agent). No raw source body or API tokens in this table.

**4. family_activity_events** — append-only event facts about actions and state transitions. Separate event-time and record-time. Preserve corrections as later events, never rewrite history.

**5. family_observations** — opt-in, contextual observations (routine outcome, friction, support strategy, food preference, etc.) with distinction between human report and agent interpretation. No diagnostic claims inferred from event data.

**6. family_action_proposals** — staged action intent and approval status; the proposal table NEVER executes a side effect on its own. Actual execution requires a trusted server tool, target-specific authorization, and an event receipt.

The first SQL migration creates these tables **without granting client read/write policies**. RLS blocks ordinary clients; the tables are inactive until authorization is repaired and server tools are built. This is deliberate, not an omission.

## Canonical data contracts

Every intelligence object must carry:
- family_id and stable UUID;
- source identity / provenance when derived from external input;
- occurred_at (when the world event happened) and recorded_at (when we learned about it), when relevant;
- actor or agent identity and an explicit confidence score for *inferred* fields (confidence is not authority to act);
- sensitivity class (normal, sensitive, restricted) for observations and proposals;
- explicit entity links, not just string tags.

Core relationship examples:
- email/document -> source for -> extracted action;
- student/person -> involved in -> routine run;
- observation -> describes -> person and routine;
- task -> belongs to -> event;
- recommendation/proposal -> supported by -> source/event evidence.

Entity linking is advisory until reviewed. Existing domain tables remain the source of UI truth during migration.

## Agent architecture (after foundation; not implemented by this PR)

**Orchestrator**:
- receives user intent and permitted external signals;
- queries authorized family context via tools rather than injecting every record into a single prompt;
- delegates to specialists; persists recommendations and evidence;
- generates action proposals with exact target, side effect, idempotency key, rationale and confidence;
- executes only via the trusted action gateway after policy/approval evaluation;
- records an event and exposes an undo/compensating workflow when possible.

**First specialists**: Capture Agent, School Agent, Chief of Staff. Later: Routine/Support, Meals, Household Workload, Finance.

**Shared memory**:
- episodic: family_activity_events and source references;
- semantic: verified entities, relationships and preferences;
- procedural: household rules and approved automation policies (separate controlled configuration);
- conversation: optional, consented summaries with scope and retention controls; not treated as ground truth.

**Action levels**:
- READ: authorized information access, no write;
- PREPARE: create draft proposal, no side effect;
- APPROVE: human review required for calendar/task writes affecting people and all external messages;
- EXECUTE: server checks actor, scope, policy, prior approval, idempotency, and target validation; then writes the audit event;
- AUTO: initially off. Later allow explicit low-risk user-defined rules only. Never infer auto-execution from model confidence alone.

## Incremental migration / implementation order

### Phase 0 — Security and baseline (blocking)
- Snapshot deployed schema and row policies; export/backup data.
- Verify production environment, deployed commit, migration history and feature flags.
- Replace permissive profile enrollment with verified family invitation and constrained membership roles; add multi-household, child/caregiver, and unauthorized-user tests.
- Move AI secrets off client-side storage where appropriate.
- Reconcile current schema drift and establish test fixtures.
- Declare a backup/rollback plan before any production migration.

### Phase 1 — Additive foundation (this draft change set)
- Add the six foundation tables with tenant-bound foreign keys, indexes and locked-down RLS.
- Add standalone TypeScript interfaces only; no current UI/reducer change, no backfill, no extra prompts, no new client reads.
- Apply and test migration in a disposable Supabase project *after* baseline schema exists.
- Confirm old application build and workflows are unchanged.

### Phase 2 — Bridge and identity
- Add a server-side, authenticated family-data API/repository with tenancy enforcement.
- Create explicit mappings from profiles and students to canonical person entities; require human confirmation where ambiguous.
- Idempotently backfill *references*, not substitute records, starting with persons/assignments/chores/events.
- Add event logging for changed entities, with dual-write behind a per-household feature flag.
- Validate counts, ownership, and reversible migration behavior.

### Phase 3 — Universal capture and consent
- One entry surface for text, microphone, photo, forwarded email and one-tap bits.
- Pipeline: source -> structured candidate -> confidence/evidence -> human review -> domain action -> event receipt.
- Build a quick-bit observation model with opt-in, deletion controls and accessibility; preserve raw signal only under separate consent and retention policies.
- Start with pasted email + school document (no Gmail sync assumption); guarantee no duplicate tasks on re-ingestion.

### Phase 4 — Orchestrator and measurable intelligence
- Introduce typed tools: list_tasks, list_events, get_sources, create_proposal, approve_proposal, execute_action.
- Implement role/scope evaluation in the tool gateway, not just prompts.
- Chief of Staff daily/weekly brief with citations back to family objects; show uncertainty.
- Support validated trends (with adequate sample size), avoid causal claims from correlation and sparse observations.
- Add activity and approval history UI, then progressively enable specialized agents.

## Non-negotiable acceptance gates

- Existing modules, local/demo mode, saved browser data, and core Supabase sync still work.
- No silent merges of student/profile identities. Existing IDs remain stable.
- No invented due dates, forced first-child mapping, or unreviewed sensitive actions.
- Each derived item can identify which source(s) support it.
- No cross-household read or write; RLS and service/API authorization tested separately.
- Agent cannot execute by editing action proposal status directly.
- Replaying the same imported input must not produce duplicate task/event side effects.
- All migrations forward-tested on disposable database before any production operation.
- No new production rollout until security Phase 0 closes.

## Suggested initial success metrics

Track actual adoption and quality, not just AI usage: capture-to-structured-item conversion, correct routing after review, duplicate rate, manual corrections, agent approval/decline ratio, time saved per household workflow, unresolved work captured, and 7/30-day active household usage. Treat these as measurements to define, not proven outcomes.

## Scope of this draft PR

**Included:** additive SQL schema, standalone app types, this blueprint, updated roadmap entry. **Not included:** running SQL, modifying existing tables or policies, live agent execution, migrating localStorage, changing user-facing behavior, editing canonical .docx/.pdf architecture documents. Upon adoption, update both canonical architecture formats per CLAUDE.md.
