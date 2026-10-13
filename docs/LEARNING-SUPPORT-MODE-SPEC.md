# Family OS — Operating Modes & Learning Support Architecture
Status: Proposed / implementation pending. Reviewed: 2026-10-13.
Owner: Family OS. Parent product: existing Family OS application.
Principle: Additive evolution; no fork, data deletion, or removal of existing capabilities.

## Executive decision
Keep the original app and module framework. Add **operating modes** as configurations of shared modules, dashboard, onboarding, navigation, and permitted agents. First specialized mode: **Learning Support**, focused on school, therapy, accommodations, and home coordination for families supporting children with learning/executive-function differences. General Family and Custom modes remain available. Agentic-first means proactive *coordination relief*, not a chatbot-first UI or unsupervised actions.

## Verified repository baseline (code inspection, not runtime QA)
- Stack: React 19, TypeScript, Vite, React Router, Supabase client, localStorage, Gemini/Claude service.
- 19 registered modules: dashboard, schoolwork, chores, calendar, finance, mealPlanning, wellness, health, shopping, allowance, pinboard, dailyAgenda, documents, familyCoach, emailIntelligence, insights, aiScan, goals, settings.
- `src/modules/{registry.ts,types.ts,ModuleContext.tsx}` contains module definitions, dependencies and localStorage enable/disable toggles. `src/components/ModuleSettings.tsx` exposes toggles. `src/App.tsx` maps enabled modules to routes and renders onboarding.
- Existing relevant investments: schoolwork, email classification/routing, AI chat/structured calls, AI document scan, Family Coach, family briefing, calendar, document vault; behavioral update models.
- `src/FamilyContext.tsx` mixes local persistence with optimistic Supabase sync; `src/App.tsx` retains several localStorage-backed datasets.
- `src/services/gmailSync.ts` states Gmail OAuth is TODO and uses mock mail. Canvas/Classroom/Google Calendar live integrations require verification/completion.
- `src/services/ai.ts` stores bring-your-own AI keys in localStorage and explicitly notes this is unsuitable for multi-tenant SaaS.
- `src/lib/schema.sql` uses RLS but has permissive onboarding insert policies; requires security review before a sensitive-data pilot.
- `ROADMAP.md` contains earlier platform tasks; preserve them in the updated roadmap.
- No integrated durable agent orchestration, action approvals/audit system, child support/IEP domain, or operating-mode registry identified.
- This is source inspection only: cloud deployment, migrated database state, credentials, end-to-end behavior, and tests were not verified.

## Product model
### Shared core
Family/person identities, child profiles, permissions, assignments/tasks, documents, calendar/events, observations, communication ingestion, structured memory, workflow execution, notifications, audit trail. A module can be **hidden** without data deletion; background jobs are independently enabled/disabled subject to permissions.

### Modes
- General Family: original module selection, original navigation/dashboard.
- Learning Support: schoolwork, calendar, documents, email intelligence, Family Coach plus child support, accommodations/goals, observations and advocacy; dedicated dashboard; background agents opt-in.
- Custom: explicit module selection and overrides.
Mode defaults + family overrides = effective configuration. Never silently overwrite individual preferences. Changing mode is reversible and never deletes records. Support families with more than one child and granular authorization for child-sensitive data.

### Learning Support landing UX
Use **exception-based management** rather than a dense dashboard:
1. Needs your decision (with source, owner, deadline).
2. Already organized (what was prepared/recorded).
3. Worth reviewing (gaps, stalled goals, unresolved follow-ups).
4. Ask Family OS (grounded answers with citations to family records).
5. Optional chronological timeline and review controls.
Surface incomplete/missing data and uncertainty, not unsupported clinical conclusions.

## Domain data contract (proposed)
Reuse `families`, `profiles`, `students`, `assignments`, `events` where appropriate. Avoid new graph DB initially. Add scoped tables/migrations for:
- `family_mode_settings` (family_id, active_mode, module_overrides, agent_overrides, dashboard_preferences, updated_by, timestamps)
- `child_support_profiles` (family_id, student_id, strengths, needs, context, visibility)
- `support_plans` (family_id, student_id, type, effective dates, status)
- `support_goals` (plan_id, baseline, target, unit, measurement_method, review_date)
- `accommodations` (plan_id, description, context, status, evidence source)
- `interventions` (student_id, method, cadence, start/end, observation)
- `observations` (family_id, student_id, observed_at, context, objective notes, source)
- `evidence_links` (source_type/id, subject_type/id, provenance/permissions)
- `commitments` (family_id, assignee, source, due_at, status)
- `agent_actions` (family_id, actor, action type, input provenance, proposal, permission level, status, approval, execution result, idempotency key, timestamps)
Design FK/indexes, RLS, storage policy, retention/deletion and role boundaries before writing migrations. Preserve original schema, backfill carefully; do not make an inferred observation a diagnosis.

## Agentic architecture
Single orchestrator and three scoped domain agents:
- School Agent: classify school messages, extract deadlines and commitments, link to child, deduplicate, suggest assignment/task/calendar updates, draft replies.
- Learning & Regulation Agent: capture routines/observations/interventions, show descriptive trends, propose low-risk family experiments; never imply causation without evidence.
- Advocacy & Planning Agent: trace accommodation/goal history, prepare school meeting summaries and evidence packs, draft follow-up tasks/emails.

Pipeline: authorized ingestion -> classification -> family/child resolution -> retrieve relevant evidence -> proposed action -> policy/approval -> idempotent execution -> verification/audit.
Three permission levels: L1 internal reversible organization, L2 reviewed record updates, L3 explicit approval for external sending or material changes. No unsupervised external communication or changes to consequential records in MVP.
Minimize AI-accessible context, require source pointers and human-correctable extraction, separate sensitive data permissions, store provider credentials server-side, and prevent cross-family data access.

## First ten workflow contracts
1. School email -> deduplicated proposed action.
2. Image/PDF -> structured facts with source review.
3. Weekly brief -> exceptions + owner + deadline.
4. Missing work -> aging unresolved assignments.
5. Observation log -> low-friction timestamped context.
6. Pattern view -> descriptive correlations, explicit uncertainty.
7. Meeting prep -> linked records, timeline, unanswered questions.
8. Meeting follow-up -> reviewed draft and commitments.
9. Accommodations -> status, evidence, implementation check.
10. Shared parent delegation -> ownership, reminders, escalation preferences.

## Mode API / implementation
- `src/modes/{types.ts,registry.ts,ModeContext.tsx,definitions/*}`: explicit stable mode IDs `general-family`, `learning-support`, `custom`.
- OperatingMode fields: id, name, description, default module IDs, dashboard key, permitted agent IDs, onboarding flow, navigation preset, optional terminology.
- Create pure resolver: registry defaults + stored legacy module prefs + chosen mode defaults + explicit overrides; recursively resolve dependencies; guard unknown IDs and cycles; preserve core modules. Do not enable newly added default modules silently for existing users.
- Distinguish `visibleModules` from `enabledBackgroundCapabilities` and `agentPermissions`.
- Persist active mode and overrides per family in Supabase when hardened; migrate legacy `family_os_module_preferences` with versioning. Initial prototype can read old settings.
- Add mode selector to Settings with preview of changes; navigation and dashboard adapt without destroying current pages/routes. Mode switching must retain all data.

## Execution phases / acceptance
### FOS-001: Mode foundation (first, non-destructive)
- Add mode types/registry/resolver and General/Learning Support/Custom definitions.
- Make state toggling deterministic; fix React state-updater lifecycle side-effect logic and transitive dependency resolution.
- Add mode selector; preserve existing module toggles, onboarding, data, routes and dashboard under General.
- Add Learning Support home shell using existing schoolwork/docs/calendar/email data (no agents yet).
- Tests: legacy prefs migration, dependency graph, mode switch, refresh persistence, hidden route guard, no deletion, multi-user behavior.
- Keep experimental mode behind flag if necessary.

### FOS-002: Learning Support data slice
- Child support profile, accommodations, support goals, observations, meeting timeline.
- DB security/migrations, family-scoped RLS, privacy, export/delete; ensure evidence links.

### FOS-003: Agentic foundations
- Backend-only AI calls and secrets; ingestion and job engine; action record/review queue/audit; dedupe/retries/idempotency; three agents in staged rollout.

### FOS-004: Pilot readiness
- Real OAuth integrations and permissions, reliable monitoring, role-bound access, family isolation tests, retention policy, 20–30 household opt-in pilot.
- Measure coordination time, task corrections, missed commitments, acceptance rates, 4/8-week retention and perceived cognitive load.

## Non-goals now
No new app/repo, no graph database requirement, no autonomous external messages, no insurance/health plan integrations, no agent-generated diagnosis, no marketplace, no native mobile rewrite, no new unrelated modes.

## Safety and rollout gates
**Before external pilot**: resolve permissive RLS onboarding policies, authenticate server-side API calls, remove browser-resident provider secrets, secure uploads and stored extracted text, document data consent/retention/deletion, test tenant and caregiver isolation. Distinguish what the code can render from what is live/production-tested.

## Next actionable move
Implement **FOS-001A** in a separate branch/PR: typed mode registry + pure configuration resolver + unit tests, no UI and no DB migration. Then **FOS-001B**: Settings selector and Learning Support dashboard shell. Review before merge.
