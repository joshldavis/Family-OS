#!/usr/bin/env bash
set -euo pipefail

test "${PGHOST:-}" = localhost
test "${PGDATABASE:-}" = fos_shared_collision
test -z "${DATABASE_URL:-}"

psql -X -v ON_ERROR_STOP=1 -f tests/database/fos005_shared_collision_fixture.sql
if psql -X -v ON_ERROR_STOP=1 -f src/lib/schema.sql >/dev/null 2>&1; then
  echo 'legacy schema unexpectedly accepted a shared profiles collision' >&2
  exit 1
fi

# Preflight fails before any Family OS table is created.
result=$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select to_regclass('public.families') is null,
          to_regclass('public.students') is null,
          to_regclass('public.profiles') is not null")
test "$result" = 't|t|t'

# The separately staged PR #5 policy cutover must also fail before revoking
# the other app's privileges or changing its existing RLS policy.
security_sql="${RUNNER_TEMP:-/tmp}/fos005-security.sql"
test -f "$security_sql"
if psql -X -v ON_ERROR_STOP=1 -f "$security_sql" >/dev/null 2>&1; then
  echo 'security proposal unexpectedly accepted a shared profiles collision' >&2
  exit 1
fi
result=$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select has_table_privilege('anon','public.profiles','INSERT'),
          exists(select 1 from pg_policies where schemaname='public'
            and tablename='profiles' and policyname='profiles_all')")
test "$result" = 't|t'
echo 'Shared-project profiles collision: both proposals blocked before writes'
