# FOS-008 — Immediate School Agent erasure on household deletion

Policy decision: a household deletion request erases completed School Agent
approval history and child details immediately. This review proposal implements
the database portion in isolation. It is **not** a live migration or an active
account-deletion route.

`family_os.school_agent_erase_family(family_id)` is callable only by the
privileged PostgreSQL operator. It locks the household, sets an erasure fence,
captures agent-generated assignment IDs, and deletes execution receipts,
claims, parent reviews, proposals, consents, sources, and those assignments in
foreign-key order. The approved-proposal and executed-claim guards permit a
DELETE only for that operator while this household's transaction-local
erasure context is set. The normal service role still cannot delete receipts
or call the erasure function. The execution RPC takes a conflicting household
lock, then checks the fence before touching a proposal. A failed delete rolls
back the whole transaction, including the fence.

The **account-deletion workflow must call this function and delete the
household in the same privileged transaction**. The household delete removes
the fence by cascade. The workflow must first stop source ingestion and
revoke active sessions, then clear other household data under its separate
reviewed policy. It must not delete a shared caregiver's Auth identity merely
because one household is removed.

CI rehearses two synthetic households. It executes an assignment in each,
injects a deletion failure to prove full rollback, verifies role denial,
erases one family, checks all six ledger tables and generated assignments are
empty only for that family, verifies the fence rejects another execution,
and deletes the household while the other family's data stays unchanged.
The local Supabase stack also executes the erasure function against a
synthetic Auth user and School Agent action.

Release limits:

- FOS-006, FOS-007 and FOS-008 remain review-only SQL proposals. The actual
  made-again schema and any other tables referencing assignments/households
  need a catalog-only dependency audit before migration planning.
- External school messages, uploads, logs, backups, and provider copies need
  separate deletion and backup-expiry procedures. Do not claim complete
  account erasure from a database-only result.
- A future source-ingestion path must honor the same erasure fence. There is
  no live ingestion or execution route in this draft stack.
- The privileged deletion operation needs operator access control, request
  authentication, incident logging without child content, and a restore plan
  before activation. Keep the normal service-role key out of that path.
