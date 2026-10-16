# FOS-005 — Isolated database verification and project identification

## What this PR verifies

The `FOS-004 Disposable PostgreSQL Verification` workflow starts a fresh
PostgreSQL 17 service inside GitHub Actions. It creates only synthetic families,
students, sources and an `auth.users` stub, then applies the FOS-004 **proposal**
to that disposable database. It runs the catalog audit and SQL assertions for
RLS, client grants, cross-family foreign keys, duplicate action claims and
incomplete approvals. The assertions run inside a transaction that rolls back.
It also uses separate PostgreSQL sessions to verify anon/authenticated role
denial, rollback after an injected write failure, and one claim plus one
synthetic assignment when two sessions race for the same source.

This verifies PostgreSQL DDL and constraints, which the mock adapter tests in
PR #16 could not verify. It does **not** prove that the real Family OS schema
matches these synthetic prerequisites, that a real Supabase Auth session can be
validated, or that the future adapter creates assignments atomically. No remote database, secrets,
Supabase CLI link, migration history or production deployment is used.

The fixture intentionally covers only the FOS-004 prerequisites. PR #2's
unmerged foundation SQL and PR #5's security work must still be reconciled
against a verified, disposable Supabase clone before deployment. The checked-in
`src/lib/schema.sql` is not applied here because it has broad client policies.

## Identify the actual Family OS project without exposing credentials

As of 2026-10-16, the two connected Supabase accounts list only **Travel
Connects Lead**, **MainStreetDiligence** and **made-again**. None is identified
as Family OS. A project name alone is insufficient proof of ownership.
The Vercel `family-os` environment metadata shows `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` assigned to both Preview and Production, but the
URL value is unavailable through the metadata view. Do not assume those
environments use different databases; confirm before enabling server writes.

1. In the Vercel **family-os** project's environment settings, ask an owner to
   inspect the *hostname/ref only* in `SUPABASE_URL` for each Production and
   Preview environment. Do not copy or share service-role, secret, anon or
   database credentials. The ref is the subdomain before `.supabase.co`.
2. In the Supabase Dashboard, locate the project whose Project URL has that
   same ref, and record its display name, organization and whether it is a
   dedicated test or production project. Confirm that the deploy environment
   being inspected actually uses that Vercel setting.
3. Connect the owning Supabase organization/account to Codex, or provide just
   the project ref and the matching environment label. Before any DB query,
   independently compare those nonsecret identifiers with the repository's
   deployment configuration. Do not infer identity from the three unrelated
   connected projects.
4. For schema reconciliation, create a **separate disposable project or local
   clone** with synthetic data. Review #5 and #2 dependency SQL, backups,
   migrations and access policies there first. Never run the FOS-004 proposal
   directly on the identified production project.

## Remaining release gates

- Confirm the actual families/students/assignments and PR #2 source/proposal
  schemas and grants before preparing a real migration.
- Implement a server-only adapter for the PR #16 contract with exact bearer
  session validation, parent membership, consistent row locks and a single
  SERIALIZABLE transaction. There is currently no execution route.
- On a verified disposable Supabase clone, test anon/authenticated access,
  revoked sessions and consent, cross-family isolation, concurrent approval
  retries, one assignment plus receipt, and rollback after each injected write
  failure. The PostgreSQL fixture here checks ledger constraints only.
- Resolve legacy onboarding policies and sensitive-data retention/erasure
  before any real school source is captured or assignment execution enabled.
