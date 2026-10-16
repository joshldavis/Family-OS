import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ledger = readFileSync(new URL('../../supabase/proposals/fos_004_school_agent_approval_ledger.sql', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../../supabase/audits/fos_004_approval_ledger_verify.sql', import.meta.url), 'utf8');
const gateway = readFileSync(new URL('../../api/_lib/schoolAgentApprovalTransaction.ts', import.meta.url), 'utf8');

test('ledger proposal is explicitly NON-ACTIVATED, not a migration', () => {
  assert.match(ledger, /NEVER RUN AGAINST PRODUCTION/);
  assert.match(ledger, /These CREATE statements are NOT a migration/);
  assert.match(ledger, /FOS-SEC-001/);
});

test('private tables, mandatory RLS and no browser role grants/policies', () => {
  for(const table of ['school_agent_source_consents','school_agent_review_receipts','school_agent_action_claims']) {
    assert.match(ledger, new RegExp('create table if not exists public\\.' + table));
    assert.match(ledger, new RegExp('alter table public\\.' + table + ' enable row level security'));
    assert.match(ledger, new RegExp('revoke all on table public\\.' + table + ' from public, anon, authenticated'));
    assert.match(audit, new RegExp(table));
  }
  assert.doesNotMatch(ledger, /create policy|grant (?:select|insert|update|delete|all|execute)\s+on.*\s+to\s+(?:authenticated|anon)/i);
});

test('source/proposal/receipt/student FKs are composite tenant constrained', () => {
  for(const constraint of [
    'school_consent_source_same_family',
    'school_review_proposal_source_same_family',
    'school_review_source_same_family',
    'school_review_student_same_family',
    'school_claim_source_same_family',
    'school_claim_proposal_same_family',
    'school_claim_receipt_same_proposal_source_family',
  ]) assert.ok(ledger.includes('constraint ' + constraint),constraint);
  assert.match(ledger, /references public\.students\(family_id, id\)/);
  assert.match(ledger, /references public\.family_action_proposals\(family_id, id, source_id\)/);
});

test('same family/source/action, proposal/action and hash each have durable unique constraints', () => {
  assert.match(ledger, /unique \(family_id, source_id, action_kind\)/);
  assert.match(ledger, /unique \(family_id, proposal_id, action_kind\)/);
  assert.match(ledger, /unique \(family_id, idempotency_digest\)/);
  assert.match(ledger, /unique \(family_id, source_id\)/);
  assert.match(ledger, /unique \(family_id, id, proposal_id, source_id\)/);
});

test('execution contract enforces verified auth and serializable transaction, not browser state', () => {
  assert.match(gateway, /verifyBearerIdentity\(/);
  assert.match(gateway, /runSerializable\(/);
  assert.match(gateway, /activeSession\(/);
  assert.match(gateway, /lockMembership\(/);
  assert.match(gateway, /lockProposal\(/);
  assert.match(gateway, /lockSourceAndConsent\(/);
  assert.match(gateway, /lockReview\(/);
  assert.match(gateway, /claimUniqueAction\(/);
  assert.match(gateway, /finalizeAction\(/);
  assert.doesNotMatch(gateway, /localStorage|user_metadata|setItem\(/i);
});

test('audit is read only and asserts RLS, grants, policies and uniqueness', () => {
  assert.match(audit, /relrowsecurity/);
  assert.match(audit, /has_table_privilege/);
  assert.match(audit, /pg_catalog\.pg_policies/);
  assert.match(audit, /missing unique source\/action claim/);
  assert.doesNotMatch(audit, /\b(?:insert|update|delete|drop|alter|create)\s+(?:into|table|from|on)\b/i);
});
