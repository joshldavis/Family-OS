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
as Family OS. The local URL matches made-again, but a project name or local
setting alone is insufficient proof that it is the intended Family OS database.
The Vercel `family-os` environment metadata shows `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` assigned to both Preview and Production, but the
URL value is unavailable through the metadata view. The Vercel dashboard
describes saved Secret values as write-only, so opening the setting cannot
reveal the ref. Both environments share the same variable entry; do not
assume Preview is isolated from Production before enabling server writes.

### Configuration findings (2026-10-16)

- The latest READY Production deployment inspected was built from `main` at
  `8125407e0913cd5bd319306390efe5cd24073528`. Its public browser bundle
  contains the app's `https://placeholder.supabase.co` fallback and no
  configured Supabase project URL. This matches the Vercel project environment
  listing, which has no `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`. The
  production browser is therefore in the repository's offline/localStorage
  mode; server-only variables do not configure the browser build.
- An ignored `.env.local` in the older local `Family-OS` checkout sets
  `VITE_SUPABASE_URL` to the project **made-again**, one of the connected
  Supabase projects. This file was not changed. Its value does not establish
  that made-again is the intended Family OS database, or what the Vercel
  server-side `SUPABASE_URL` points to.
- Vercel's server-side `SUPABASE_URL` is a write-only Secret. Its value was
  unavailable in both the connected metadata tool and the dashboard edit view.
  No service-role key or other credential was inspected.

Before any cloud cutover, have the project owner identify the intended Family
OS project in the Supabase Dashboard and decide whether use of made-again in
the local checkout is intentional. Configure browser variables for an isolated
Preview environment only after PR #5's security cutover and the schema/role
checks pass. Do not copy Production service-role credentials into Preview.

1. In the Supabase Dashboard, locate the project intended for Family OS.
   Record only its project ref (the subdomain before `.supabase.co`), display
   name, organization, and whether it is a test or production project. Confirm
   explicitly whether the locally configured made-again project is intentional.
2. If an owner has the original Vercel `SUPABASE_URL` value in a trusted
   configuration record, compare only its ref with that dashboard project.
   The saved Vercel Secret cannot be revealed through the current dashboard
   or connector. Do not share a service-role, secret, anon or database key.
3. Connect the owning Supabase organization/account to Codex, or provide just
   the intended project ref and environment label. Before any DB query,
   reconcile that identity with the deployment plan; do not infer identity
   solely from the local made-again setting.
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
