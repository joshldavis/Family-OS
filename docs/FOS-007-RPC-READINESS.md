# FOS-007 — Atomic School Agent RPC review

The shared made-again project is the intended Family OS host. Its nonsecret
project reference, `mivuyqyayhiolelrfyxu`, was confirmed from the connected
Supabase project list. The saved Vercel `SUPABASE_URL` remains write-only, so
the runtime must compare its URL to this reference before any server write.

## Why this path

The existing Vercel service-role API key cannot authenticate a direct Postgres
connection. A narrowly granted PostgREST RPC uses that key without requiring
another database password or another paid Supabase project. The proposed
`public.school_agent_execute_reviewed_assignment` function is `SECURITY
INVOKER`, executable only by `service_role`, and performs every check and
write in one database transaction. It leaves the private `family_os` schema
unexposed to the Data API. The exact-session helper from FOS-006 is still the
only `SECURITY DEFINER` read of `auth.sessions`.

The server caller verifies the parent's bearer through `auth.getUser(token)`.
Only after Auth succeeds does it extract that token's session ID and call the
RPC through a **different** service-role client. The bearer is never passed
to the service client or to SQL. The SQL rechecks the exact session, active
owner membership, consent version, source revision, student, and immutable
review. SQL errors abort the transaction; retryable database conflicts cause
the caller to repeat the whole RPC. A committed result can be retried safely
because the claim has a unique family/source/action key.

`createSchoolAgentServiceRpcAdapters` fails closed unless an explicit enable
flag is `true`, `VERCEL_ENV` is `production`, and the configured HTTPS URL is
exactly the catalog-confirmed made-again project. Preview cannot use the
shared project for School Agent writes. This guard does not activate the
feature: there is no HTTP execution route or browser action in this PR.

## Isolated verification

Disposable PostgreSQL CI applies FOS-006 followed by the FOS-007 review
proposal. It compares the SQL revision hash with the TypeScript calculation,
including quotes, Unicode, and alternate DateStyle. It checks role grants,
expired sessions, cross-family denial, stale revisions, consent revoke and
regrant, full rollback on an injected assignment failure, idempotent repeat,
and five concurrent attempts. Local TypeScript tests check the target guard,
bearer handling, response validation, and whole-call retry. A separate CI job
starts an unlinked, disposable local Supabase stack with synthetic users to
check real Auth, Data API grants, exact-session signout, and RPC idempotency.

No FOS-007 SQL has been run on made-again. There is no migration file, live
credential, production route, merge, or production deployment.

## Remaining release gates

1. Reconcile and pin the existing shared `family_os` workspace migration and
   membership functions. FOS-006 and FOS-007 are review proposals, not
   ready-to-run migrations.
2. Integrate the agreed immediate-erasure policy with the full household
   deletion workflow. `FOS-008-HOUSEHOLD-ERASURE.md` describes the isolated
   database proposal and the remaining external-data and operator gates.
3. Compare the Vercel server-side URL with the confirmed project reference
   through the runtime guard, review production environment settings, and
   only then add an authenticated route behind an explicit activation flag.

References: [Supabase database functions](https://supabase.com/docs/guides/database/functions),
[custom schema exposure](https://supabase.com/docs/guides/api/using-custom-schemas),
[local development](https://supabase.com/docs/guides/local-development/cli-workflows),
[PostgreSQL transactions in PostgREST](https://docs.postgrest.org/en/v13/references/transactions.html).
