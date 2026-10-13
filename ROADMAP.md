# Family OS — Product & Engineering Roadmap
Updated: 2026-10-13. Source of truth for modes: [Operating Modes & Learning Support Architecture](docs/LEARNING-SUPPORT-MODE-SPEC.md).

## Product direction
**One Family OS, configurable operating modes.** Preserve the current general-family app; introduce a focused Learning Support experience for school/therapy/learning-support households. Build data provenance and controlled agentic execution to reduce parental coordination burden. Do not fork the app or delete disabled module data.

## Immediate build queue (ordered)
- [ ] **FOS-001A — Mode foundation, no UI**: typed OperatingMode registry with General Family, Learning Support, Custom; pure default/override/dependency resolver; preserve legacy localStorage preferences; unit tests for migration, unknown/cyclic/transitive dependencies and backwards compatibility. Separate branch/PR.
- [ ] **FOS-001B — Mode selection & navigation**: Settings operating-mode selector, preview changes, make enabled routes and mode-specific dashboard agree; hidden routes inaccessible while hidden modules retain data; switching/refresh smoke tests.
- [ ] **FOS-001C — Learning Support home shell**: decision queue, organized items, review reminders, source links, manual review; reuses existing schoolwork/calendar/docs/email services; no new autonomous execution.
- [ ] **FOS-002 — Learning Support data slice**: child support profile, plans/goals, accommodations, interventions, observations, evidence/meetings and commitments; migration + scoped RLS + child-level permissions + tests.
- [ ] **FOS-003A — Secure AI & workflow backbone**: server-side AI proxy/secrets, authenticated intake, durable orchestrator, queue, auditable proposed actions, permissions, idempotent execution.
- [ ] **FOS-003B — First three agents**: School Agent first, then Learning/Regulation Agent and Advocacy/Planning Agent; review before external communications.
- [ ] **FOS-004 — External-pilot hardening**: production Gmail/Calendar/classroom integrations as needed, auth/RLS audit, privacy/retention/export, tests/observability, and small family pilot.

## Critical risk gates (before external user/children's sensitive data)
- [ ] Review `src/lib/schema.sql` onboarding INSERT policies (`with check (true)`) and cross-family isolation.
- [ ] Move browser-local Gemini/Claude API keys and sensitive AI execution server-side.
- [ ] Validate Supabase auth, household membership, role/child-level access and cross-device consistency.
- [ ] Secure document storage/extracted text, consent and retention/deletion.
- [ ] Distinguish mock integration paths from live sync; verify deployed runtime and existing migrations.

## Existing roadmap preserved (reconciled with current files)
### Existing module backlog
- [ ] Wellness module: **verify current implementation** against original checklist (module definition/page now exist); habits, shared goals, health logs.
- [ ] Family Goal Marketplace: templates, progress tracking, allowances/rewards integration. **Defer** until Learning Support wedge is validated.

### Integration backlog
- [ ] Gmail auto-sync: live OAuth + background authorized ingestion; current `gmailSync.ts` uses mock data.
- [ ] Canvas LMS import: confirm API credentials and implement tested assignment sync.
- [ ] Google Classroom direct sync: authenticated announcements/assignments/grades.
- [ ] Google Calendar real bidirectional sync: replace simulated flows and handle conflicts.

### Infrastructure backlog
- [ ] Real authentication & multi-tenant isolation: **partly implemented in Auth/Supabase**; verify deployment, RLS, invites, and full state hydration before marking complete.

### Previous completed checklist
- [x] Unified AI model configuration UI in Settings (implementation exists; production security not yet resolved).
- [x] AI Scan module registration/toggle in Settings.

## MVP metrics
- Correct classification, human correction rate, proposed-action acceptance, outstanding commitments, minutes of parent coordination saved, caregiver mental load, weekly use and 4/8-week household retention.

## Deferred on purpose
No separate repo, no graph DB initially, no autonomous school/provider communication, no unrelated modes, no marketplace/enterprise sales push before core retention.
