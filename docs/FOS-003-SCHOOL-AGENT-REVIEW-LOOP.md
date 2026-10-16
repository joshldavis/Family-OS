# FOS-003 — School Agent closed-loop review lab

**Status:** Draft, stacked on [PR #13](https://github.com/joshldavis/Family-OS/pull/13). No production changes, backend integration or database migration.

## Parent-facing job: understand, correct, decide

In Learning Support → **School Agent Intake Lab**, the fictional school notice now moves through an explicit three-step practice loop:

1. **Create a fictional source candidate.** Parent enters an invented sender, classification, title, date and optional student. The candidate is fingerprinted locally, with missing or invalid fields called out. There is no Gmail, school API, AI provider or server call.
2. **Review and correct.** Parent can change proposed title, student and date. They must check the fictional-source acknowledgment plus separate title/student/date confirmations. Students are **synthetic Demo Student A/B records**, not actual children from Family OS. An unspecified child remains unspecified; no fabricated due date or child mapping occurs.
3. **Approve fictional draft only.** For assignments with complete confirmations, the lab shows an in-memory, non-executing receipt that previews an intended `create_schoolwork_assignment` action. It **does not create a Schoolwork record**, persist an approval, execute a job, send a notification or authenticate a real parent. Event/communication classification does not have a draft-approval path. Parents can dismiss, flag for correction or undo.

These corrections and local acknowledgment have **no standing outside this synthetic UI**. There is no route that converts local browser decisions to server authorization.

## Safeguards

- Feature still requires `VITE_FAMILY_OPERATING_MODES=true` plus `VITE_FAMILY_SCHOOL_AGENT_SANDBOX=true`; no new live-data toggle.
- Only the locally selected Parent role in Learning Support sees the synthetic lab; this is a **demo UX gate**, never a trusted backend role.
- Separate in-memory receipt keyed by fictional source fingerprint, family and assignment kind. Repeat review of the exact synthetic source within the same session is blocked. This is **not database-enforced idempotency**.
- Corrections after a draft review discard the previous receipt, forcing another explicit review.
- Repeated intake of a changed fictional source creates a different source fingerprint (expected for this mock data); real Gmail ingestion will use provider message IDs and family-scoped uniqueness constraints.
- The source revision fingerprint is a *UX change detector*, not a cryptographic authorization signature.
- Invalid title (empty, multiline, >200 chars), incomplete dates, unrelated student IDs, missing acknowledgments, children, wrong household and unsupported classifications fail closed in deterministic tests.
- Clearing the demo session or refreshing erases all local records and receipts. No localStorage, IndexedDB or API writes.
- No medical, behavioral, diagnostic, IEP or real school email content.

## Manual QA script (isolated Learning Lab only)

Use a demo parent and select Learning Support in Settings. Do not enter real names, personal emails, medical data, school messages or IEP information.

1. Enter **fictional** sender `teacher@example.org`, select Assignment, title `Library worksheet`, choose Demo student A, and an invented valid due date. Click **Preview source review**.
2. Confirm the candidate shows the kind, fingerprint, and missing-field checks. Scroll to **Step 2 — Correct and confirm**.
3. Confirm **Approve fictional draft only** shows a helpful error until all four acknowledgment/confirmation checkboxes are selected.
4. After checks, approve. See **Step 3 — Demo draft approved** and the preview action including title/student/deadline. Open Schoolwork separately: **no task was created**.
5. Edit deadline/title after approval. Earlier receipt vanishes and confirmations must be repeated.
6. Try missing due date, missing student and invalid event time. The assignment must be corrected before approval; events do not permit draft approval.
7. Approve the same fictional source twice; duplicate review is blocked. Undo the session draft and check that review can proceed again.
8. Flag needs correction, dismiss, undo. Refresh page or Clear demo session; drafts disappear.
9. Switch to General Family / sign in as demo child: new review loop is not available.
10. Confirm no network requests to AI provider, Gmail, Supabase or an approval API during review.

## Hard blockers before a real School Agent

- Confirm the actual Family OS Supabase project reference and existing household grant/RLS policies.
- Reconcile [security PR #5](https://github.com/joshldavis/Family-OS/pull/5) and [intelligence PR #2](https://github.com/joshldavis/Family-OS/pull/2) with the UI branch.
- Implement a server-side consented school source connector, verified Auth identity and active household membership (never client role), source/child ownership checks, durable consent revocation and approval audit trail.
- Implement transactionally idempotent task writes **only after a server-verified parent approval**, with current source revision checks, concurrency protection, role revocation, retention and undo policy.
- Perform isolated DB rehearsal and browser accessibility/security QA before any production cutover.

This demo is a UX and contract validation milestone, **not** fulfillment of the real execution/security milestone.
