import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReviewedAssignmentViaRpc,
  type SchoolAgentRpcAdapters, type SchoolAgentRpcArguments } from './schoolAgentRpcExecutor.ts';
import { FAMILY_OS_SHARED_PROJECT_REF,
  validateSchoolAgentRpcTarget } from './schoolAgentRpcTarget.ts';

const actorId = '00000000-0000-0000-0000-000000000001';
const sessionId = '00000000-0000-0000-0000-000000000101';
const familyId = '00000000-0000-0000-0000-00000000000a';
const proposalId = '00000000-0000-0000-0000-000000000021';
const approvalId = '00000000-0000-0000-0000-000000000031';
const receiptId = '00000000-0000-0000-0000-000000000041';
const expectedRevision = 'a'.repeat(64);
const payload = Buffer.from(JSON.stringify({ session_id: sessionId })).toString('base64url');
const authorization = `Bearer eyJhbGciOiJub25lIn0.${payload}.synthetic-signature`;
const request = { familyId, proposalId, approvalId, expectedRevision };

function adapters(call: SchoolAgentRpcAdapters['call']): SchoolAgentRpcAdapters {
  return {
    auth: { async getUser(token) {
      return { data: { user: token === authorization.slice(7) ? {
        id: actorId, email: 'parent@example.invalid',
        email_confirmed_at: '2026-10-19T00:00:00Z', is_anonymous: false,
      } : null }, error: null };
    } },
    call,
  };
}

test('production target guard accepts only the confirmed project and explicit activation', () => {
  const base = { supabaseUrl: `https://${FAMILY_OS_SHARED_PROJECT_REF}.supabase.co`,
    serviceRoleKey: 'never-print-this-key', vercelEnvironment: 'production',
    executionEnabled: 'true' };
  assert.deepEqual(validateSchoolAgentRpcTarget(base),
    { ok: true, url: base.supabaseUrl });
  assert.deepEqual(validateSchoolAgentRpcTarget({ ...base, executionEnabled: 'false' }),
    { ok: false, reason: 'disabled' });
  assert.deepEqual(validateSchoolAgentRpcTarget({ ...base, vercelEnvironment: 'preview' }),
    { ok: false, reason: 'unsafe_environment' });
  assert.deepEqual(validateSchoolAgentRpcTarget({ ...base, serviceRoleKey: undefined }),
    { ok: false, reason: 'missing_configuration' });
  for (const supabaseUrl of [
    'https://unrelated.supabase.co',
    `http://${FAMILY_OS_SHARED_PROJECT_REF}.supabase.co`,
    `https://user:password@${FAMILY_OS_SHARED_PROJECT_REF}.supabase.co`,
    `https://${FAMILY_OS_SHARED_PROJECT_REF}.supabase.co/other`,
    `https://${FAMILY_OS_SHARED_PROJECT_REF}.supabase.co?override=1`,
  ]) {
    const result = validateSchoolAgentRpcTarget({ ...base, supabaseUrl });
    assert.deepEqual(result, { ok: false, reason: 'wrong_project' });
    assert.equal(JSON.stringify(result).includes(base.serviceRoleKey), false);
    assert.equal(JSON.stringify(result).includes(supabaseUrl), false);
  }
});

test('verified parent token sends only IDs and revision to the service RPC', async () => {
  let received: SchoolAgentRpcArguments | null = null;
  const result = await executeReviewedAssignmentViaRpc(authorization, request,
    adapters(async args => {
      received = args;
      return { data: { ok: true, executed: true, familyId,
        assignmentId: 'school:synthetic', actionReceiptId: receiptId }, error: null };
    }));
  assert.deepEqual(result, { ok: true, executed: true, familyId,
    assignmentId: 'school:synthetic', actionReceiptId: receiptId });
  assert.deepEqual(received, {
    p_actor_auth_id: actorId, p_session_id: sessionId,
    p_family_id: familyId, p_proposal_id: proposalId,
    p_expected_revision: expectedRevision, p_approval_id: approvalId,
  });
  assert.equal(JSON.stringify(received).includes(authorization), false);
});

test('invalid identity, session and RPC responses fail before any assignment result', async () => {
  let calls = 0;
  const rpc = adapters(async () => { calls++; return { data: null, error: null }; });
  assert.deepEqual(await executeReviewedAssignmentViaRpc('Bearer invalid-token-1234567890',
    request, rpc), { ok: false, executed: false, reason: 'invalid_identity' });
  assert.deepEqual(await executeReviewedAssignmentViaRpc(authorization,
    { ...request, expectedRevision: 'bad' }, rpc),
    { ok: false, executed: false, reason: 'invalid_request' });
  assert.equal(calls, 0);

  assert.deepEqual(await executeReviewedAssignmentViaRpc(authorization, request, rpc),
    { ok: false, executed: false, reason: 'transaction_failed' });
  assert.equal(calls, 1);
  const wrongFamily = adapters(async () => ({ data: { ok: true, executed: true,
    familyId: '00000000-0000-0000-0000-00000000000b',
    assignmentId: 'school:synthetic', actionReceiptId: receiptId }, error: null }));
  assert.deepEqual(await executeReviewedAssignmentViaRpc(authorization,
    request, wrongFamily), { ok: false, executed: false, reason: 'transaction_failed' });
  const erasing = adapters(async () => ({ data: {
    ok: false, executed: false, reason: 'family_erasing',
  }, error: null }));
  assert.deepEqual(await executeReviewedAssignmentViaRpc(authorization,
    request, erasing), { ok: false, executed: false, reason: 'family_erasing' });
});

test('serialization conflict retries the whole RPC with identical arguments', async () => {
  const seen: SchoolAgentRpcArguments[] = [];
  const result = await executeReviewedAssignmentViaRpc(authorization, request,
    adapters(async args => {
      seen.push(args);
      return seen.length === 1 ? { data: null, error: { code: '40001' } } :
        { data: { ok: true, executed: false,
          reason: 'already_executed', familyId }, error: null };
    }));
  assert.deepEqual(result, { ok: true, executed: false,
    reason: 'already_executed', familyId });
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0], seen[1]);
});
