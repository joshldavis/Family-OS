# FOS-002 — School Agent source capture + trusted read-only approval boundary

**Implementation status:** Draft / opt-in in `feature/fos-002-school-agent-trust-contract`, stacked on FOS-001D [PR #12](https://github.com/joshldavis/Family-OS/pull/12). No migration or live backend integration. **Never use for real/sensitive school data.**

## Delivered in this draft

1. **Intake adapter from Family Intelligence draft PR #2.**
   `src/intelligence/captureCandidates.ts` maps already-classified school email into a candidate for review. It links to a source reference, marks unknown child, missing/invalid date or event time as needing correction, and never creates Calendar or Schoolwork records. `sourceFingerprint.ts` computes a stable SHA-256 reference for duplicate review. Copied foundational code is now co-located with the UI stack; reconcile the sibling PR #2 during actual merge.
2. **Parent-facing School Agent Intake Lab.** With BOTH `VITE_FAMILY_OPERATING_MODES=true` and `VITE_FAMILY_SCHOOL_AGENT_SANDBOX=true`, a parent in Learning Support sees a form to enter **fictional** school notice fields (type, sample sender, title, date/time and selected household student). Classification is **manual**, not automatic AI. The form never requests the message body. It creates a candidate in component memory; it does not send emails, create tasks, write to localStorage or call Supabase. The candidate describes missing evidence rather than inventing details. The feature remains OFF by default and separate from the existing Decision Inbox flag.
3. **Verified identity primitive copied from security draft PR #5.** `api/_lib/verifiedIdentity.ts` checks the Supabase bearer token through the trusted Auth `getUser` service, requiring a confirmed nonanonymous identity. It deliberately does NOT grant membership. Reconcile with PR #5 at merge.
4. **Read-only server approval boundary** `api/_lib/schoolAgentApprovalPreview.ts`. It requires three **trusted read adapters** which are not installed in production: DB membership (active parent of same family), family-scoped proposal fetch, and family-scoped student verification. The server recomputes proposal content revision; rejects changed, foreign, unconsented, unsupported, unconfirmed or missing data; and returns an assignment **plan** with `executed:false`. It cannot persist approvals or execute actions. Only school assignment creation is contemplated; Calendar, actions, behavior observations and announcements remain unsupported.
5. **Regression tests** for bearer identity, parent membership, errors, consent, revision, child association, source references, idempotency proposal stability, no writes, missing time and household isolation. Build matrix tests normal, Operating Modes, Parent Inbox and sandbox flags.

## Trust boundaries

The browser is NOT a trustworthy approval principal. Do **not** use `FamilyContext.currentUser.role`, client-supplied `familyId`, model confidence, student name match, or the local **Approve draft only** button to authorize a task. The preview contract gets the Supabase identity from Auth (not session metadata) and checks family membership independently through a DB adapter. All proposal content is loaded from the backend, not user-submitted action fields.

The `trustedProposalRevision` is a **source-content change detector, not a digital signature or proof of consent**. Its idempotency digest is a **proposed key, not a lock**. Real idempotency requires unique constraints and transactionally enforced state changes. This contract is safe to run with test adapters only and has no production route.

Supabase's service-role/secret credentials bypass RLS; they must never reach the browser. We must distinguish table grants from row policies, and validate both before using the real Family OS project. The existing Vercel Family OS preview and production configurations reportedly share backend credentials; do not point unreviewed preview code at those.

## Why real execution is blocked

As of October 14, 2026, the connected Supabase account lists MainStreetDiligence, made-again, and Travel Connects Lead; **no verified Family OS database project reference** has been identified. Existing repository SQL contains permissive family/profile assumptions. We have NOT run any migration or touched a live Supabase project.

The upstream contracts need actual database-backed implementations, reviewed grants/RLS and an authenticated proof of ownership before a real parent approval can be stored. The current local-only Decision Inbox intentionally loses state on refresh.

## Contract for first real School Agent (implementation prerequisites)

1. Identify the exact Family OS Supabase **project reference only** (never share API keys or decrypted values). Verify the currently deployed API endpoint and auth setup.
2. Inspect existing DB safely (read-only): schemas, grants, RLS, membership data and possible cross-family policies. Prepare backups and enrollment migration/rehearsal in a **non-production** project.
3. Merge/reconcile drafts #5 and #2 with these stacked app PRs after resolving schema dependencies.
4. A server transaction must: validate fresh Auth identity, verify active household parent membership, lock family-owned source and proposal, validate source revision, accepted consent, owner, confirmed student/date/title and exact action, atomically enforce a unique `(family, source, action)` idempotency constraint, insert the intended Schoolwork entry, and produce an audit/undo receipt. Fail closed on lost membership, revoked consent, stale proposals, concurrent retries or cross-household requests.
5. Real source ingestion (Gmail, Google Classroom, school messages) must have source consent, minimal retention, encryption/access safeguards and no browser AI key use. Behavioral/medical/IEP content is explicitly out of scope for the first task workflow.
6. Add tests for concurrent approvals, expiration, re-ingestion duplicates, timezone, deleted sources, revocation, unverified user, child role, wrong family, failed DB transaction and recovery; conduct isolated pilot QA before rollout.

## Preview walkthrough (synthetic examples ONLY)

Open the access-protected Learning Lab **branch preview**; set Operating Mode to Learning Support. In the new Intake Lab, try:
- assignment "Book report" for a same-household student with a valid date → a review candidate, **not a task**;
- assignment missing its date or selected student → correction issues, no guessed values;
- a calendar event without a time → needs time correction;
- changing sender/title/date → a different source fingerprint, but no durable dedup check.

Refresh and confirm the candidate disappears. Leave the main Learning Lab and Family OS production unchanged while this is reviewed.

## Official security guidance referenced

- https://supabase.com/docs/guides/auth/server-side/creating-a-client — verify identity via `getUser` or signed `getClaims`, never trust the unvalidated user object from `getSession`.
- https://supabase.com/docs/guides/database/postgres/row-level-security — table grants and policies are distinct; verify both.
- https://supabase.com/docs/guides/getting-started/api-keys — server service role bypasses RLS.
