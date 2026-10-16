#!/usr/bin/env bash
set -euo pipefail

test "${PGHOST:-}" = localhost
test "${PGDATABASE:-}" = fos_dependency_rehearsal
test -z "${DATABASE_URL:-}"

int_ref=bb8450eb7162eedec606de453d2503c38e3f69aa
sec_ref=0e57841459c7ec2dc13655a79ef832e20fd664ec
git fetch --depth=1 origin \
  '+refs/heads/architecture/family-intelligence-foundation-20261013:refs/remotes/origin/architecture/family-intelligence-foundation-20261013' \
  '+refs/heads/security/fos-sec-001-household-boundaries:refs/remotes/origin/security/fos-sec-001-household-boundaries'
test "$(git rev-parse origin/architecture/family-intelligence-foundation-20261013)" = "$int_ref"
test "$(git rev-parse origin/security/fos-sec-001-household-boundaries)" = "$sec_ref"

int_sql="${RUNNER_TEMP:-/tmp}/fos005-intelligence.sql"
sec_sql="${RUNNER_TEMP:-/tmp}/fos005-security.sql"
git show "$int_ref:supabase/migrations/20261013000000_family_intelligence_foundation.sql" > "$int_sql"
git show "$sec_ref:supabase/proposals/fos_sec_001_household_lockdown.sql" > "$sec_sql"
printf '%s  %s\n' \
  '881d7e52c7e59581a26367938dc949825ae7c53c80a3f432a245e163d31c1d8e' "$int_sql" \
  '73bd868b4cabf7a893cd79479a6731a8309282b8d132ce59f30f842728111105' "$sec_sql" \
  '358dfcbd5be8dfead269e7f865b0ed4a6fe1572f10523bb8ef12dc0eecaa2174' src/lib/schema.sql \
  | sha256sum --check --status

psql -X -v ON_ERROR_STOP=1 -f tests/database/fos005_dependency_bootstrap.sql
psql -X -v ON_ERROR_STOP=1 -f src/lib/schema.sql
psql -X -v ON_ERROR_STOP=1 -f "$sec_sql"
psql -X -v ON_ERROR_STOP=1 -f "$int_sql"
psql -X -v ON_ERROR_STOP=1 -f supabase/proposals/fos_004_school_agent_approval_ledger.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/audits/fos_004_approval_ledger_verify.sql
psql -X -v ON_ERROR_STOP=1 -f tests/database/fos005_dependency_verify.sql
