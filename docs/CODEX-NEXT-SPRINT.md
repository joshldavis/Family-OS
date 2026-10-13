# Codex handoff — Family OS foundation, first implementation sprint

Repository: https://github.com/joshldavis/Family-OS

**Start by reading** CLAUDE.md, ROADMAP.md, docs/FAMILY-INTELLIGENCE-FOUNDATION.md, src/lib/schema.sql, src/types.ts, src/FamilyContext.tsx, src/services/supabaseSync.ts, src/pages/Auth.tsx, src/App.tsx and the canonical docs/Family-OS-Architecture.pdf. The current review branch is architecture/family-intelligence-foundation-20261013. Verify the real repository and deployed environment before modifying code.

## Mission

Make the existing Family OS a safe, multi-household, canonical data platform **without removing or disabling any existing module**. This is a foundation sprint, not a UI rewrite and not agent autonomy.

## Non-negotiable constraints

- Do not rewrite, delete, or migrate production data without a verified backup and explicit release plan.
- Do not push directly to main. Open small reviewable PRs.
- Existing React routes, feature settings, local/demo mode, browser-saved data and Supabase sync must continue to function.
- The additive schema in supabase/migrations is a **draft**. Do not apply it to production until verified in a disposable Supabase project and membership authorization is fixed.
- No API keys or service-role tokens in frontend code, localStorage for production secrets, committed files, or client-exposed VITE_ env vars.
- Protect sensitive children/health/support records with explicit consent, least privilege and clear retention/deletion controls.
- No auto-merge of profiles and students based on matching names; no blind first-child fallback.
- The AI may propose an action but only a trusted server tool can authorize/execute it.

## Sprint tasks — execute in order

### A. Baseline and security audit
1. Inventory all persisted domains, owners, keys, SQL tables, and deployed schema differences. Produce a readable source-of-truth matrix (module / localStorage key / Supabase table / actor / permissions / migration status).
2. Identify and test existing household-crossing risks. In checked-in schema.sql, the profiles insert policy is WITH CHECK (true). Design a verified invite/join server flow and RLS rules that cannot grant oneself membership by choosing another family_id.
3. Reconcile contradictions between application types and database: students.notes, transactions.source, completion metadata, event provider values and create/update idempotency. Do not assume the checked-in SQL mirrors deployed Supabase.
4. Add automated tests for auth isolation: unauthenticated, a parent in family A, a parent in family B, child role, revoked invite, duplicate invite use, unauthorized profile insertion, and denial of cross-family data.
5. Record successful npm run build and core smoke tests. Document known deviations.

### B. Validate the draft foundation migration
1. Stand up a disposable Supabase database with the existing baseline schema applied.
2. Apply supabase/migrations/20261013000000_family_intelligence_foundation.sql in that **disposable** environment.
3. Verify all six tables, composite family FKs, indexes, append-only event updates, idempotency indexes, and service-only access.
4. Verify normal anon/authenticated clients get zero rows and cannot write foundation tables while policies are absent; verify the privileged erasure path can delete a family and its related data without leaving orphaned data.
5. Add repeatable migration and RLS tests and a rollback/recovery note. Do not apply to production.

### C. Prepare the safe bridge (separate PR)
1. Build a repository/server gateway for the new tables using server-side verified household membership and per-resource capabilities.
2. Add a deterministic identity mapping contract for students and profiles. Provide a human-review queue for ambiguous matches.
3. Create idempotent reference backfill for assignments, chores, events, plus a write-audit event stream, behind a disabled-by-default flag.
4. Add source records and audit events to the email classification path, but initially keep them shadow-only. No new calendar/assignment writes until reviewed.
5. Add conflict retry and rollback tests for an interrupted dual-write.

## Acceptance checks

- A current household can use every original module unchanged.
- A fresh demo-mode user can still onboard without a Supabase account.
- No unauthorized household can read or create another household's records.
- The new tables are inert without trusted server access.
- Re-ingesting the same school email twice does not create duplicate tasks/events once the new pathway is enabled.
- Every proposed derived object can be traced to its source.
- Typed status + confidence never substitute for authorization to act.
- No deployment, merge or prod DB mutation was performed automatically.

## Deliverables

1. Focused, reviewable PR(s) with tests and migrations.
2. Updated docs/ROADMAP with completed vs not-yet-implemented scope.
3. A before/after table proving which data now lives where.
4. Build/test output and explicit blockers.
5. One end-to-end demonstration: pasted school message -> extracted candidate -> verified child -> approval request -> safe draft task with source reference (no automatic send).

Avoid adding more standalone modules in this sprint.
