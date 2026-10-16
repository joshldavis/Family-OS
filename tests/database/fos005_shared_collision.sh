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
echo 'Shared-project profiles collision: blocked before writes'
