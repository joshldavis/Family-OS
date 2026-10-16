#!/usr/bin/env bash
set -euo pipefail

test "${PGHOST:-}" = localhost
test "${PGDATABASE:-}" = fos004_disposable
test -z "${DATABASE_URL:-}"

psql -X -v ON_ERROR_STOP=1 -f tests/database/fos004_concurrency_setup.sql

# The untrusted roles have no direct table grants.
if psql -X -v ON_ERROR_STOP=1 -c \
  'set role anon; select count(*) from public.school_agent_action_claims' \
  >/dev/null 2>&1; then
  echo 'anon unexpectedly read the ledger' >&2
  exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c \
  'set role authenticated; select count(*) from public.school_agent_review_receipts' \
  >/dev/null 2>&1; then
  echo 'authenticated unexpectedly read the ledger' >&2
  exit 1
fi

# Inject a failure after both writes; disconnect rolls back the transaction.
if psql -X -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
begin;
with claim as (
  insert into public.school_agent_action_claims
    (family_id, source_id, proposal_id, approved_receipt_id,
     action_kind, idempotency_digest)
  values ('family-a', '00000000-0000-0000-0000-000000000011',
          '00000000-0000-0000-0000-000000000021',
          '00000000-0000-0000-0000-000000000031',
          'create_schoolwork_assignment', repeat('b',64))
  returning id, family_id
)
insert into public.assignments (id, family_id, student_id, title, due_date)
select id::text, family_id, 'student-a', 'Synthetic worksheet', current_date
from claim;
select 1/0;
commit;
SQL
then
  echo 'injected database failure did not abort' >&2
  exit 1
fi

counts=$(psql -X -At -v ON_ERROR_STOP=1 -c \
  'select (select count(*) from public.school_agent_action_claims),
          (select count(*) from public.assignments)')
test "$counts" = '0|0'

# Two independent PostgreSQL connections compete for the same source/action.
psql -X -v ON_ERROR_STOP=1 -f tests/database/fos004_claim_worker.sql >/dev/null &
first=$!
psql -X -v ON_ERROR_STOP=1 -f tests/database/fos004_claim_worker.sql >/dev/null &
second=$!
wait "$first"
wait "$second"

counts=$(psql -X -At -v ON_ERROR_STOP=1 -c \
  'select (select count(*) from public.school_agent_action_claims),
          (select count(*) from public.assignments)')
test "$counts" = '1|1'
echo 'Role denial, rollback and concurrent uniqueness: passed'
