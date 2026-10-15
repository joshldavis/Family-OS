import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previewTrustedSchoolAction, trustedProposalRevision,
  type SchoolAgentReadAdapters, type TrustedSchoolProposal,
} from './schoolAgentApprovalPreview.ts';

const token = 'Bearer verified-token-1234567890';
const familyId = 'family-a';
const proposalId = 'proposal-one';
const actorId = 'auth-parent-one';

const sourceData: Omit<TrustedSchoolProposal, 'revision'> = {
  id: proposalId, familyId, sourceSystem: 'school_email',
  sourceRefDigest: 'pasted-sha256-' + 'a'.repeat(64),
  kind: 'assignment', title: 'Reading worksheet',
  date: '2026-10-21', studentId: 'student-a', reviewStatus: 'ready_for_review',
  consentCapturedAt: '2026-10-14T18:00:00.000Z',
  titleConfirmedByParent: true, studentConfirmedByParent: true,
  dateConfirmedByParent: true,
};
function proposal(changes: Partial<Omit<TrustedSchoolProposal, 'revision'>> = {}): TrustedSchoolProposal {
  const content = { ...sourceData, ...changes };
  return { ...content, revision: trustedProposalRevision(content) };
}

function testAdapters(changes: Partial<SchoolAgentReadAdapters> = {}): SchoolAgentReadAdapters {
  return {
    auth: {
      async getUser() {
        return {
          data: { user: { id: actorId, email: 'verified@school.org',
            email_confirmed_at: '2026-10-01T00:00:00Z', is_anonymous: false } },
          error: null,
        };
      },
    },
    async getMembership() {
      return { authUserId: actorId, familyId, role: 'parent', status: 'active' };
    },
    async getProposal() { return proposal(); },
    async studentBelongsToFamily(fam, student) {
      return fam === familyId && student === 'student-a';
    },
    ...changes,
  };
}

async function run(adapters = testAdapters(), options: Record<string, string> = {}) {
  return previewTrustedSchoolAction(token, {
    familyId, proposalId, expectedRevision: proposal().revision, ...options,
  }, adapters);
}

test('server-owned confirmed assignment can be planned, but NEVER executed', async () => {
  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(result.executed, false);
  if (!result.ok) return;
  assert.equal(result.status, 'review_only_not_authorized_for_execution');
  assert.equal(result.actorAuthUserId, actorId);
  assert.deepEqual(result.proposedAction, {
    kind: 'create_schoolwork_assignment', title: 'Reading worksheet',
    studentId: 'student-a', dueDate: '2026-10-21',
  });
  assert.match(result.proposedIdempotencyKey, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes('verified@school.org'), false);
  assert.equal(JSON.stringify(result).includes('rawText'), false);
});

test('no bearer token fails before touching any private adapters', async () => {
  let lookups = 0;
  const adapters = testAdapters({
    async getMembership() { lookups++; return null; },
    async getProposal() { lookups++; return null; },
  });
  const result = await previewTrustedSchoolAction(null, {
    familyId, proposalId, expectedRevision: proposal().revision,
  }, adapters);
  assert.deepEqual(result, { ok: false, reason: 'missing_token', executed: false });
  assert.equal(lookups, 0);
});

test('invalid, unverified and anonymous auth must fail closed', async () => {
  for (const user of [
    null,
    { id: actorId, email: 'some@school.org', email_confirmed_at: null },
    { id: actorId, email: 'some@school.org', email_confirmed_at: '2026-10-01', is_anonymous: true },
  ]) {
    const adapters = testAdapters({
      auth: { async getUser() { return { data: { user }, error: null }; } },
    });
    const result = await run(adapters);
    assert.equal(result.ok, false);
  }
  const error = await run(testAdapters({
    auth: { async getUser() { throw new Error('Auth server unreachable'); } },
  }));
  assert.deepEqual(error, { ok: false, reason: 'auth_unavailable', executed: false });
});

test('trusted active parent membership is mandatory, not request/user_metadata role', async () => {
  const membershipCases = [
    null,
    { authUserId: actorId, familyId, role: 'child' as const, status: 'active' as const },
    { authUserId: actorId, familyId, role: 'parent' as const, status: 'revoked' as const },
    { authUserId: actorId, familyId, role: 'parent' as const, status: 'pending' as const },
    { authUserId: 'someone-else', familyId, role: 'parent' as const, status: 'active' as const },
    { authUserId: actorId, familyId: 'family-b', role: 'parent' as const, status: 'active' as const },
  ];
  for (const membership of membershipCases) {
    let readSource = false;
    const result = await run(testAdapters({
      async getMembership() { return membership; },
      async getProposal() { readSource = true; return proposal(); },
    }));
    assert.deepEqual(result, { ok: false, reason: 'membership_denied', executed: false });
    assert.equal(readSource, false);
  }
});

test('family-scoped proposal read never accepts a different family or mismatched source', async () => {
  for (const source of [null, proposal({ familyId: 'family-b' }),
    proposal({ id: 'proposal-from-another-family' })]) {
    const result = await run(testAdapters({ async getProposal() { return source; } }));
    assert.deepEqual(result, { ok: false, reason: 'source_not_found', executed: false });
  }
});

test('stale visible revision and tampered server source revision fail closed', async () => {
  const stale = await run(testAdapters(), { expectedRevision: 'b'.repeat(64) });
  assert.deepEqual(stale, { ok: false, reason: 'source_changed', executed: false });
  const tampered = await run(testAdapters({
    async getProposal() { return { ...proposal(), title: 'Surprise revised title' }; },
  }));
  assert.deepEqual(tampered, { ok: false, reason: 'source_changed', executed: false });
});

test('consent, date, student and parent confirmations gate any future approval', async () => {
  for(const changes of [
    { consentCapturedAt: null },
    { consentCapturedAt: 'not-an-iso-date' },
    { reviewStatus: 'needs_correction' as const },
    { date: null }, { date: '2026-02-29' },
    { studentId: null }, { title: '   ' },
    { dateConfirmedByParent: false }, { titleConfirmedByParent: false },
    { studentConfirmedByParent: false },
  ]) {
    const source = proposal(changes);
    const result = await run(testAdapters({ async getProposal() { return source; } }),
      { expectedRevision: source.revision });
    assert.equal(result.ok, false, JSON.stringify(changes));
    if ('consentCapturedAt' in changes) assert.equal(result.ok || result.reason === 'consent_required', true);
  }
});

test('sensitive behavioral categories are categorically excluded from action planning', async () => {
  for (const kind of ['behavior_observation', 'event', 'announcement', 'action'] as const) {
    const source = proposal({ kind });
    const r = await run(testAdapters({ async getProposal() { return source; } }),
      { expectedRevision: source.revision });
    assert.deepEqual(r, { ok: false, reason: 'unsupported_action', executed: false });
  }
});

test('student lookup checks family, and backend errors do not authorize', async () => {
  const wrong = await run(testAdapters({ async studentBelongsToFamily() { return false; } }));
  assert.deepEqual(wrong, { ok: false, reason: 'student_not_verified', executed: false });
  for(const failing of [
    { getMembership: async () => { throw Error('db'); } },
    { getProposal: async () => { throw Error('db'); } },
    { studentBelongsToFamily: async () => { throw Error('db'); } },
  ]) {
    const r = await run(testAdapters(failing));
    assert.deepEqual(r, { ok: false, reason: 'data_unavailable', executed: false });
  }
});

test('retries yield stable proposed keys, not actual database idempotency', async () => {
  const p1 = await run();
  const p2 = await run();
  assert.equal(p1.ok && p2.ok, true);
  if (p1.ok && p2.ok) {
    assert.equal(p1.proposedIdempotencyKey, p2.proposedIdempotencyKey);
    assert.equal(p1.executed, false);
    assert.equal(p2.executed, false);
  }
  const alternate = proposal({ sourceRefDigest: 'pasted-sha256-' + 'b'.repeat(64) });
  const p3 = await run(testAdapters({ async getProposal() { return alternate; } }),
    { expectedRevision: alternate.revision });
  assert.equal(p3.ok, true);
  if (p1.ok && p3.ok) assert.notEqual(p1.proposedIdempotencyKey, p3.proposedIdempotencyKey);
});

test('reject malformed/oversize requests after verifying identity', async () => {
  for (const request of [
    { familyId: '', proposalId, expectedRevision: proposal().revision },
    { familyId, proposalId: '../other', expectedRevision: proposal().revision },
    { familyId, proposalId, expectedRevision: 'not-a-digest' },
    { familyId: 'x'.repeat(200), proposalId, expectedRevision: proposal().revision },
  ]) {
    const r = await previewTrustedSchoolAction(token, request, testAdapters());
    assert.deepEqual(r, { ok: false, reason: 'invalid_request', executed: false });
  }
});
