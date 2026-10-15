# FOS-001D — Parent Decision Inbox (safe UI prototype)

**Status:** Draft implementation on `feature/fos-001d-parent-decision-inbox`, stacked on FOS-CAL-001 [PR #11](https://github.com/joshldavis/Family-OS/pull/11), FOS-001C [PR #9](https://github.com/joshldavis/Family-OS/pull/9) and previous mode PRs. **NOT deployed to Family OS production.**

## Product intention

The first piece of the agentic experience answers: **What needs my attention, what are you suggesting, and where did it come from?** We are not turning on an autonomous school agent, email synchronization, or automatic task creation.

### UX contract

- In Learning Support, only a signed-in parent sees the **Parent decision inbox** when `VITE_FAMILY_DECISION_INBOX=true` AND `VITE_FAMILY_OPERATING_MODES=true`. The additional flag is OFF by default, independently of Operating Modes.
- Derived suggestions: overdue and soon-due, household-linked assignments; assignments with missing/invalid due dates; same-household events with missing/invalid dates or times. Other scheduled events are already shown in the existing overview, not treated as action requests.
- Evidence is limited to the existing household-scoped Schoolwork and Calendar read models. Each suggestion explains the reason, student (if verified through same-family student ID), date or missing date, recorded source label, and opens the corresponding source module. The app does not falsely claim that a provider/source label is verified.
- Parent options: **Approve draft only**, **Needs correction**, **Dismiss for now**, and **Undo** in session review history. Missing assignment dates require the parent to supply a valid date before draft approval; invalid calendar event times cannot be approved until the source is fixed.
- Parents may record a short optional private note, limited to 400 characters, and may edit a proposed date **for the local draft only**.
- No task creation, date mutation, message sending, notification, external model call, integration call, Supabase write, localStorage write, or server-side approval receipt. All review decisions are **in memory for the current page session only** and disappear on refresh/navigation. They are labeled "draft only / not executed" throughout the UI.
- If the visible source evidence (record title, date, related child, status-derived bucket, provenance, etc.) changes, a draft review with an earlier revision no longer counts as current. Client revision matching is only a UX safeguard, **not a cryptographically secure source check**.
- General Family and Custom modes, children, and non-parent roles see their existing dashboard, not this inbox. Other modules are unchanged.

## What this does NOT do

- No authorization server; role/family identity are from existing client app state and do not establish trust. Completing [FOS-SEC-001](https://github.com/joshldavis/Family-OS/issues/3) is mandatory before real or sensitive household approvals.
- No school-email body, behavioral records, diagnoses, IEP content, or document text are read. A verified Family Intelligence gateway and explicit source-level consent are required before using any of those sources.
- No durable parent decisions across sessions, devices or families. Any future persistent decision queue must enforce family membership and role checks server-side, write an immutable action/audit receipt, support concurrency/idempotency and verify latest source revision.
- No invented deadlines. An edited "proposed date" is not a verified assignment deadline and is never written back to Schoolwork.
- Existing legacy browser state is not fully tenant-isolated; demo preview only.

## Manual QA

1. Use an **isolated, Vercel-auth-protected Learning Lab preview** with `VITE_FAMILY_OPERATING_MODES=true` and `VITE_FAMILY_DECISION_INBOX=true`, and NO connected Supabase secrets.
2. As a Parent in General Family, confirm the ordinary dashboard is unchanged.
3. Select Learning Support in Settings and Apply. Confirm the new review inbox appears above the existing Needs Attention / Organized / Review sections.
4. Review an overdue/due-soon assignment. Click Schoolwork link, then return and approve its draft. Confirm the item moves to session history, not that Schoolwork was changed.
5. Review an assignment without a due date; confirm the Approve button stays disabled until a valid date is entered. Verify entered date has not changed source record.
6. Review an invalid calendar event. Confirm correction, not approval, is offered and Calendar source remains unchanged.
7. Dismiss a suggestion, undo, and confirm it returns to pending. Refresh the page: all session approvals disappear.
8. Change modes to General Family and back; verify no approval or review appears in another family session.
9. Simulate a changed underlying record; earlier draft approval should no longer count as current.
10. Verify no network requests for inbox actions, no email/Calendar writes, and no background agent/cron trigger.
11. Check keyboard traversal, long text, and mobile layout.
12. Do not enable for live child support records before server-side RLS and identity verification.

## Production approval gateway (future FOS-INT-002)

1. Authenticated actor identity + role/membership verified at server.
2. Source reference, source revision, and candidate dedup stored in family-scoped RLS tables; minimize content/retention.
3. Parent can review and **confirm exact intended action** (including corrected child, deadline, destination).
4. Approval executes an atomic, idempotent, family-authorized task/calendar change with a receipt; stale/concurrent approval fails closed.
5. Source-linked immutable action trail and parent undo/correction policy.
6. Incrementally activate in isolated pilot only after reviewed security cutover, privacy testing and explicit consent.
