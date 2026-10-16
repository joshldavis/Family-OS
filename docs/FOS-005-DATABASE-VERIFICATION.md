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

A second disposable PostgreSQL database rehearses the checked-in legacy
`src/lib/schema.sql`, the exact pinned security SQL from draft PR #5, the exact
pinned intelligence SQL from draft PR #2, and the FOS-004 ledger proposal in
dependency order. It checks that staged tables and RLS exist and that the
permissive household onboarding policies have been removed. Pinned commit and
file hashes make changes to those draft dependencies fail visibly until
reviewed. This does not inspect or alter the shared made-again project.

This verifies PostgreSQL DDL and constraints, which the mock adapter tests in
PR #16 could not verify. It does **not** prove that the real Family OS schema
matches these synthetic prerequisites, that a real Supabase Auth session can be
validated, or that the future adapter creates assignments atomically. No remote database, secrets,
Supabase CLI link, migration history or production deployment is used.

The first fixture intentionally covers only the FOS-004 prerequisites. The
second rehearsal applies the checked-in legacy schema only inside disposable
CI PostgreSQL, then exercises the staged security proposal. A verified,
disposable Supabase clone is still needed for platform-specific Auth, Data API,
Realtime, grants, and actual migration behavior before deployment.

## Identify the actual Family OS project without exposing credentials

As of 2026-10-16, the two connected Supabase accounts list **Travel Connects
Lead**, **MainStreetDiligence** and **made-again**. The owner confirmed that
made-again is intentionally used for Family OS to avoid another paid project.
It is a shared project; only the owner-authorized catalog reads documented
below were sent there. No migration or user-row query was run.
The specific Vercel server-side URL remains unverifiable because it is a
write-only Secret.
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
  `VITE_SUPABASE_URL` to the confirmed shared project **made-again**. This file
  was not changed. It still does not establish what the Vercel server-side
  `SUPABASE_URL` points to.
- Vercel's server-side `SUPABASE_URL` is a write-only Secret. Its value was
  unavailable in both the connected metadata tool and the dashboard edit view.
  No service-role key or other credential was inspected.

Before any cloud cutover, verify the existing made-again schema and app
ownership without assuming Family OS can safely create generic `public`
tables such as `profiles` and `families` alongside another app. Configure
browser variables only after PR #5's security cutover and the schema/role
checks pass. Do not copy Production service-role credentials into Preview.

1. In the Supabase Dashboard, confirm that the made-again project and its
   organization are the shared deployment target. Record only its project ref
   and whether it contains production data for either app. Do not run draft SQL
   against it as a way to discover its schema.
2. If an owner has the original Vercel `SUPABASE_URL` value in a trusted
   configuration record, compare only its ref with that dashboard project.
   The saved Vercel Secret cannot be revealed through the current dashboard
   or connector. Do not share a service-role, secret, anon or database key.
3. Reconcile the Vercel server-side Secret with the intended project using an
   owner's trusted configuration record or a reviewed credential rotation.
   The current connector cannot reveal the saved URL. Keep Preview isolated
   from any shared production database during testing.
4. For schema reconciliation, use a **local or CI disposable database** with
   synthetic data. Review #5 and #2 dependency SQL, backups, migrations and
   access policies there first. A new paid Supabase project is not required
   for these tests. Never run the FOS-004 proposal directly on made-again.

### Shared-project collision gate

The cost-saving arrangement is compatible with local and CI development, but
the proposed Family OS SQL uses generic names in `public` (`families`,
`profiles`, `students`, `assignments`). `CREATE TABLE IF NOT EXISTS` is not a
compatibility check: an existing made-again table with the same name could be
silently reused. The draft security proposal could also change policies or
grants on a shared table. Passing the disposable rehearsal above proves the
draft files coexist with Family OS's checked-in schema, **not** with the
current made-again schema.

PR #2 already contains `supabase/audits/family_os_readonly_baseline.sql`, a
catalog-only inventory of relations, columns, policies, foreign keys,
privileged functions and grants. Preview and Production currently share one
Vercel service-role Secret entry, so Preview is not a safe rehearsal target.

### Catalog-only finding on made-again (authorized 2026-10-16)

The owner explicitly allowed a catalog-only audit. It read `pg_catalog` and
`information_schema` metadata for relation names, `public.profiles` columns,
policies and grants; it did not read family rows, credentials, or write SQL.
The shared project has `public.profiles` but no `public.families`,
`public.students` or `public.assignments`. Its `profiles` columns are
`user_id uuid`, `display_name text`, `current_household_id uuid`, and
`created_at timestamptz`. It has a `profiles_all` RLS policy based on
`user_id = auth.uid()`. Family OS expects `id text`, `auth_id uuid`,
`family_id text` and `role text`; these are different data models.

This is a **confirmed collision**. Applying the legacy `src/lib/schema.sql`
to made-again would be unsafe because `CREATE TABLE IF NOT EXISTS` could reuse
the existing `public.profiles`. The staged PR #5 security SQL also targets
`public.profiles`, including revoking browser mutation privileges and indexing
`auth_id`. It must not be applied to made-again. The legacy schema and the
separate draft PR #5 proposal now each start with an atomic preflight. A
synthetic made-again signature is tested in disposable CI against both; its
existing RLS policy and client grants remain intact after rejection. The broader
cutover must use the existing `family_os` namespace and a reviewed server/data-access
design before any shared-project migration.

### Existing Family OS workspace (catalog-only finding, 2026-10-16)

The same authorized catalog audit found an existing `family_os` schema in
made-again. It contains RLS-enabled tables including `students`, `assignments`,
`child_profiles`, `chores`, `events`, and budgets, plus `families` and `profiles`
views. The views use `security_invoker=true` and expose the verified active
household; their source tables are `public.households` and
`public.household_members`. Catalog metadata confirms `family_os.families.id`
and the `family_id` columns of `profiles`, `students`, and `assignments` are
`uuid`. Its `profiles` view is read-only to authenticated clients. No family
rows were queried. The local, currently untracked
`supabase/migrations/20261013170515_family_os_workspace.sql` in the older
checkout describes this layout, but is not a reviewed or pinned PR dependency.

This explains why the owner recalled setting up Family OS in made-again.
It also changes the next step: adapt PR #2's source/proposal tables and PR #16's
approval ledger to the existing `family_os` schema, UUID household IDs, and
current RLS model in an isolated fixture. Their current `public`/text-ID SQL
cannot be applied to made-again. Review the existing workspace migration and
its prerequisite membership hardening before treating either as a release
baseline. The legacy dependency rehearsal does not validate compatibility
with this live workspace.

The separate `fos_006_shared_workspace_school_ledger.sql` review proposal now
models the School Agent's minimal source, proposal, consent, review and claim
tables under `family_os` with UUID household IDs. It starts with a fail-closed
schema preflight, creates no execution route or client policy, and revokes
browser-role grants while granting the server-only service role on new tables.
A new disposable CI database simulates the
observed shared `public.profiles` shape and `family_os` students/assignments,
then checks tenant-bound references, incomplete approvals, duplicate claims,
RLS and grants. This is a **contract rehearsal**, not an executable migration:
the fixture does not reproduce all live Auth, membership functions, triggers,
Data API configuration or Supabase behavior. The full PR #2 intelligence
schema still needs adaptation and review; only its source/proposal subset is
represented here. No migration has been run against made-again.

## Remaining release gates

- Reconcile the existing `family_os` workspace and its membership functions
  with PR #2 source/proposal tables and PR #16 ledger in a disposable database.
- Implement a server-only adapter for the PR #16 contract with exact bearer
  session validation, parent membership, consistent row locks and a single
  SERIALIZABLE transaction. There is currently no execution route.
- On a verified disposable Supabase clone, test anon/authenticated access,
  revoked sessions and consent, cross-family isolation, concurrent approval
  retries, one assignment plus receipt, and rollback after each injected write
  failure. The PostgreSQL fixture here checks ledger constraints only.
- Resolve legacy onboarding policies and sensitive-data retention/erasure
  before any real school source is captured or assignment execution enabled.
