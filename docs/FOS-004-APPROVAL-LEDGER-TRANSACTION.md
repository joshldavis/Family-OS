# FOS-004 — Atomic parent-approved assignment contract & private ledger

**State:** Staged, UNEXECUTED database proposal and tested transaction adapter interface. No production backend connection. Stacked on [PR #15](https://github.com/joshldavis/Family-OS/pull/15).

## Why

The Parent Decision Inbox and School Agent Lab have useful review UX, but their client approvals cannot authorize writes. Next, we need backend invariants: a real parent identity, a current school source and consent, an explicitly approved immutable receipt, tenant ownership, a unique source/action claim, and a transaction that creates **one** assignment and **one** action receipt or creates neither.

## Shipped in this draft

- `supabase/proposals/fos_004_school_agent_approval_ledger.sql` is a **review-only proposal**, not a migration. It depends on FOS-INT-001's `public.family_sources` and `public.family_action_proposals` and the existing families/students tables. Never apply without inspecting actual schema, cutting over onboarding security [PR #5](https://github.com/joshldavis/Family-OS/pull/5), and rehearsing in an isolated DB.
- `public.school_agent_source_consents`: family-scoped source consent state (pending/active/revoked), actor and timestamps. Does not prove sender authenticity.
- `public.school_agent_review_receipts`: append-only **by application contract**, exact parent-reviewed title/student/due date and source revision. DB checks and tenant-bound composite FKs prevent cross-family associations; external policies may still affect immutability after deployment.
- `public.school_agent_action_claims`: atomic unique `(family_id,source_id,action_kind)` and `(family_id,proposal_id,action_kind)` claims; prevents duplicate writes from retries/concurrency when executor uses one serializable transaction.
- All three tables enable RLS, grant no rights to `anon` or `authenticated`, have **no client policies**, and have no triggers that execute domain actions. A trusted server process must be explicitly wired later.
- `api/_lib/schoolAgentApprovalTransaction.ts`: **unwired contract** for a trusted server adapter with `runSerializable()` plus session/membership/source/consent/proposal/approval row locks. It rechecks parent identity and exact source revision, confirms same-family student, validates consent and approval, then claims one action, creates the assignment and finalizes an action receipt. It returns no sensitive email content.
- Mock adapter regression tests cover 10 concurrent attempts, exact one-write semantics, replay, revoked session and consent, child/other-family attempts, stale source, changed approvals, student lookup, bad data and rollback when assignment or audit insertion fails.
- `supabase/audits/fos_004_approval_ledger_verify.sql`: **read-only** catalog checks for RLS, privileges, policies and a unique claim. Only run after disposable database rehearsal. Static SQL safeguards have tests.

## Execution ordering required from an actual backend adapter

1. Verify Supabase Auth via `getUser(token)`, not `getSession` or caller-supplied profile role.
2. In a single **SERIALIZABLE** database transaction, verify the **specific bearer session** is still active (not merely that the user has any active session; never log or store the bearer token), lock authenticated parent membership and family proposal.
3. Lock school source and source-specific consent. Check source origin, source digest, consent active and not revoked. Lock trusted approval receipt.
4. Recompute source revision from server-held data, confirm student is owned by family, compare exact reviewed title/student/deadline with approved receipt, ensure reviewer is same authenticated parent for v1.
5. Atomically `INSERT` a unique claim. On successful new claim, insert assignment with explicit `family_id` + `student_id` and write action receipt. Commit together; no partial claim or partial task.
6. On conflict for already executed source, return no-op; on still-claimed conflict return error. On any database error (including failed audit write) roll back all writes.
7. Run the complete transaction again when handling serialization retries; never retry only the assignment insertion.

**Current function is not an HTTP route and has no real database adapter.** Its mocked unit tests prove the orchestration logic under the specified adapter contract, NOT PostgreSQL transactional behavior or live RLS. Those require separate integration tests.

## Production blockers and warnings

- **Incorrect Supabase project unresolved:** available connected projects are not identified as Family OS. Never apply the proposal to an unrelated database or reuse production credentials in the Learning Lab.
- **Security cutover unresolved:** existing `src/lib/schema.sql` uses permissive onboarding and broad client writes (including assignments). Approval uniqueness cannot secure Family OS until server-side household membership and existing table policies are reconciled.
- **Upstream branches not merged:** FOS-INT-001 [PR #2](https://github.com/joshldavis/Family-OS/pull/2) and FOS-SEC-001 [PR #5](https://github.com/joshldavis/Family-OS/pull/5) require a coordinated, tested merge/migration plan. Do not independently deploy this SQL.
- **Consent scope:** source-level consent doesn't cover Gmail OAuth scopes, sender authenticity, age/child privacy notices, classroom access agreements, or data retention. All must be designed before real capture.
- **Privacy:** Review receipts contain title, student ID and deadline, which may be sensitive. Enforce encryption/storage retention, access logging and deletion/erasure workflow. `ON DELETE RESTRICT` on student-reviewed receipts requires a privileged erasure policy; do not silently retain child's info forever.
- **Source revision:** the SHA-256 source revision is a consistency token (not an authorization signature). Approval row cannot be produced from untrusted browser input.
- **Transaction lock and atomic claim** are specified as adapter obligations. Before activation, implement and test actual Postgres `SERIALIZABLE` / `FOR UPDATE` locking, unique conflict handling, session revocation and transaction-scoped service-role authorization.
- **No browser release yet:** the Learning Lab remains the safe, fictional, non-executing UX until real auth/RLS and consent are audited.

## Verification plan before production

1. Identify correct Supabase project **ref only**, verify its deploy/origins and inspect catalog permissions without pulling family row contents.
2. Rehearse migrations in disposable DB in dependency order (#5 and #2 reviewed, then FOS-004).
3. Execute `supabase/audits/fos_004_approval_ledger_verify.sql` in that test DB; run grant/RLS/role tests for nonmember, child, pending and revoked parent.
4. Build the actual adapter behind a server-only route that does not accept `title`, `studentId`, `dueDate` or browser approval state; supports idempotent concurrent retries.
5. Confirm one assignment and one audit receipt in real PostgreSQL after at least 10 overlapping approvals; inject DB failures between claim, assignment and receipt and confirm rollback.
6. Verify revoked session and revoked consent fail at commit, not just at initial request; test privacy, deletion and account revocation.
7. Only then opt in an isolated pilot and do hands-on mobile/desktop QA.

## Scope and user-facing impact

No UI changes, no production PR merges or deployments. This is deliberately a backend-security milestone. The already working [Learning Lab PR #15](https://github.com/joshldavis/Family-OS/pull/15) remains available for UX feedback.
