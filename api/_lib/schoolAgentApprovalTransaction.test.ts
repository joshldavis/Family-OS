import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReviewedAssignment, type SchoolAgentExecutionTx,
  type SchoolAgentApprovalAdapters, type TrustedLockedReview,
  type TrustedLockedSource } from './schoolAgentApprovalTransaction.ts';
import { trustedProposalRevision, type TrustedSchoolProposal,
  type TrustedHouseholdMembership } from './schoolAgentApprovalPreview.ts';

const familyId = 'family-a', otherFamily = 'family-b';
const actorAuthUserId = 'parent-auth-1', studentId = 'student-a';
const sourceId = 'source-1', proposalId = 'proposal-1', approvalId = 'approval-1';
const token = 'Bearer test-auth-token-12345678';

function schoolProposal(patch: Partial<Omit<TrustedSchoolProposal, 'revision'>> = {}): TrustedSchoolProposal {
  const source = {
    id: proposalId, familyId, sourceSystem: 'school_email' as const,
    sourceRefDigest: 'pasted-sha256-' + 'a'.repeat(64), kind: 'assignment' as const,
    title: 'Library worksheet', date: '2026-10-19', studentId,
    reviewStatus: 'ready_for_review' as const,
    consentCapturedAt: '2026-10-16T00:00:00Z', consentStatus: 'active' as const,
    titleConfirmedByParent: true, studentConfirmedByParent: true, dateConfirmedByParent: true,
    ...patch,
  };
  return { ...source, revision: trustedProposalRevision(source) };
}

class FakeSerializedDatabase {
  currentProposal: TrustedSchoolProposal = schoolProposal();
  membership: TrustedHouseholdMembership | null = {
    familyId, authUserId: actorAuthUserId, role: 'parent', status: 'active',
  };
  source: TrustedLockedSource | null = {
    familyId, sourceId, sourceRefDigest: schoolProposal().sourceRefDigest,
    consentStatus: 'active', consentGrantedAt: '2026-10-16T00:00:00Z',
  };
  review: TrustedLockedReview | null = {
    id: approvalId, familyId, proposalId, sourceId,
    sourceRevision: schoolProposal().revision, decision: 'approved',
    reviewedByAuthUserId: actorAuthUserId, confirmedTitle: 'Library worksheet',
    confirmedStudentId: studentId, confirmedDueDate: '2026-10-19',
  };
  sessionActive = true;
  ownsStudent = true;
  failAssignment = false;
  failFinalization = false;
  assignments: Array<{ id: string; familyId: string; studentId: string }> = [];
  receipts: string[] = [];
  claimKeys = new Map<string, 'claimed' | 'executed'>();
  reads = { auth: 0, membership: 0, proposal: 0, review: 0 };
  private mutex: Promise<unknown> = Promise.resolve();

  adapter(): SchoolAgentApprovalAdapters {
    return {
      auth: {
        getUser: async () => {
          this.reads.auth++;
          return {
            data: { user: {
              id: actorAuthUserId, email: 'parent@example.org',
              email_confirmed_at: '2026-10-16T00:00:00Z', is_anonymous: false,
            } }, error: null,
          };
        },
      },
      runSerializable: async callback => {
        // Simulated SERIALIZABLE transaction with single-writer lock and
        // private snapshot. Writes become visible only when callback succeeds.
        let unlock = () => {};
        const next = new Promise<void>(resolve => { unlock = resolve; });
        const previous = this.mutex;
        this.mutex = previous.then(() => next);
        await previous;
        const assignments = this.assignments.map(x => ({ ...x }));
        const receipts = [...this.receipts];
        const claims = new Map(this.claimKeys);
        const tx: SchoolAgentExecutionTx = {
          activeSession: async (authId, bearerHeader) =>
            this.sessionActive && authId === actorAuthUserId && bearerHeader === token,
          lockMembership: async () => { this.reads.membership++; return this.membership; },
          lockProposal: async () => { this.reads.proposal++; return this.currentProposal; },
          lockSourceAndConsent: async () => this.source,
          lockReview: async () => { this.reads.review++; return this.review; },
          studentBelongsToFamily: async (fam,student) =>
            this.ownsStudent && fam === familyId && student === studentId,
          claimUniqueAction: async claim => {
            const key = JSON.stringify([claim.familyId, claim.sourceId, claim.kind]);
            if (claims.has(key)) return claims.get(key) === 'executed' ?
              'already_executed' : 'conflict';
            claims.set(key, 'claimed');
            return 'claimed';
          },
          createAssignment: async input => {
            if (this.failAssignment) throw new Error('DB insert failed');
            const item = { id: 'saved-assignment-' + (assignments.length + 1),
              familyId: input.familyId, studentId: input.studentId };
            assignments.push(item);
            return item;
          },
          finalizeAction: async fields => {
            if (this.failFinalization) throw new Error('DB audit failed');
            const key = JSON.stringify([fields.familyId,fields.sourceId,'create_schoolwork_assignment']);
            claims.set(key, 'executed');
            const actionReceiptId = 'saved-receipt-' + (receipts.length + 1);
            receipts.push(actionReceiptId);
            return { actionReceiptId };
          },
        };
        try {
          const result = await callback(tx);
          this.assignments = assignments; this.receipts = receipts; this.claimKeys = claims;
          return result;
        } finally {
          unlock();
        }
      },
    };
  }
}

function request(overrides: Record<string, unknown> = {}) {
  return { familyId, proposalId, approvalId,
    expectedRevision: schoolProposal().revision, ...overrides };
}
async function submit(db: FakeSerializedDatabase, overrides: Record<string, unknown> = {}) {
  return executeReviewedAssignment(token, request(overrides), db.adapter());
}

test('trusted parent executes precisely one atomic assignment and audit receipt', async () => {
  const db = new FakeSerializedDatabase();
  const result = await submit(db);
  assert.deepEqual(result, {
    ok: true, executed: true, familyId,
    assignmentId: 'saved-assignment-1', actionReceiptId: 'saved-receipt-1',
  });
  assert.equal(db.assignments.length, 1);
  assert.equal(db.receipts.length, 1);
  assert.equal(db.claimKeys.size, 1);
  assert.equal(JSON.stringify(result).includes('parent@example.org'), false);
});

test('idempotent repeat and concurrent approvals cannot create duplicate assignments', async () => {
  const db = new FakeSerializedDatabase();
  const results = await Promise.all(Array.from({ length: 10 }, () => submit(db)));
  assert.equal(results.filter(r => r.executed).length, 1);
  assert.equal(results.filter(r => r.ok && !r.executed).length, 9);
  assert.equal(db.assignments.length, 1);
  assert.equal(db.receipts.length, 1);
  assert.equal(db.claimKeys.size, 1);
});

test('authorization before source lookup rejects child, revoked, mismatched memberships', async () => {
  for (const membership of [
    null,
    { familyId, authUserId: actorAuthUserId, role: 'child' as const, status: 'active' as const },
    { familyId, authUserId: actorAuthUserId, role: 'parent' as const, status: 'revoked' as const },
    { familyId: otherFamily, authUserId: actorAuthUserId, role: 'parent' as const, status: 'active' as const },
    { familyId, authUserId: 'another-auth-user', role: 'parent' as const, status: 'active' as const },
  ]) {
    const db = new FakeSerializedDatabase();db.membership = membership;
    assert.deepEqual(await submit(db),
      { ok: false, executed: false, reason: 'membership_denied' });
    assert.equal(db.reads.proposal, 0);
    assert.equal(db.assignments.length, 0);
  }
});

test('revoked Auth session blocks actions even if JWT identity previously passed', async () => {
  const db = new FakeSerializedDatabase();db.sessionActive = false;
  assert.deepEqual(await submit(db),
    { ok: false, executed: false, reason: 'inactive_session' });
  assert.equal(db.reads.membership, 0);
});

test('specific session is validated, not merely that another session of same user is active', async () => {
  const db = new FakeSerializedDatabase();
  const result = await executeReviewedAssignment(
    'Bearer other-user-session-12345678', request(), db.adapter(),
  );
  assert.deepEqual(result, { ok: false, executed: false, reason: 'inactive_session' });
  assert.equal(db.reads.membership, 0);
  assert.equal(db.assignments.length, 0);
});

test('cross-family source and source digest substitution fail closed', async () => {
  for (const source of [
    null, { ...new FakeSerializedDatabase().source!, familyId: otherFamily },
    { ...new FakeSerializedDatabase().source!, sourceRefDigest: 'pasted-sha256-' + 'b'.repeat(64) },
  ]) {
    const db = new FakeSerializedDatabase();db.source=source;
    assert.deepEqual(await submit(db),
      { ok: false, executed: false, reason: 'source_not_found' });
    assert.equal(db.assignments.length, 0);
  }
});

test('withdrawn consent fails closed even with otherwise valid parent approval', async () => {
  for (const status of ['pending','revoked'] as const) {
    const db = new FakeSerializedDatabase();db.source = { ...db.source!, consentStatus: status };
    assert.deepEqual(await submit(db),
      { ok: false, executed: false, reason: 'consent_denied' });
  }
});

test('stale or changed source revision cannot use an earlier approval', async () => {
  const db = new FakeSerializedDatabase();
  assert.deepEqual(await submit(db, { expectedRevision: 'f'.repeat(64) }),
    { ok: false, executed: false, reason: 'stale_source' });
  db.currentProposal = { ...db.currentProposal, title: 'Title changed without revised hash' };
  assert.deepEqual(await submit(db),
    { ok: false, executed: false, reason: 'stale_source' });
  assert.equal(db.assignments.length, 0);
});

test('same-family student verification and exact approved fields are mandatory', async () => {
  const badStudent = new FakeSerializedDatabase(); badStudent.ownsStudent=false;
  assert.deepEqual(await submit(badStudent),
    { ok: false, executed: false, reason: 'student_not_verified' });
  for(const changed of [
    { decision: 'withdrawn' as const },
    { reviewedByAuthUserId: 'not-this-parent' },
    { familyId: otherFamily }, { sourceId: 'another-source' },
    { confirmedTitle: 'Different title' }, { confirmedStudentId: 'someone-else' },
    { confirmedDueDate: '2026-11-02' }, { sourceRevision: 'b'.repeat(64) },
    { proposalId: 'another-proposal' }, { id: 'wrong-id' },
  ]) {
    const db=new FakeSerializedDatabase();db.review = { ...db.review!, ...changed };
    assert.deepEqual(await submit(db),
      { ok: false, executed: false, reason: 'approval_denied' }, JSON.stringify(changed));
    assert.equal(db.assignments.length, 0);
  }
});

test('no action for unverified/incomplete/unsupported proposals', async () => {
  for(const changes of [
    {kind: 'event' as const}, { reviewStatus: 'needs_correction' as const },
    {date: null}, {studentId:null}, {title:'\nInjection'},
    {titleConfirmedByParent:false}, {studentConfirmedByParent:false},
    {dateConfirmedByParent:false},
  ]) {
    const db=new FakeSerializedDatabase();db.currentProposal=schoolProposal(changes);
    db.review={...db.review!,sourceRevision:db.currentProposal.revision};
    const result=await submit(db,{expectedRevision:db.currentProposal.revision});
    assert.deepEqual(result,{ok:false,executed:false,reason:'unconfirmed_assignment'});
  }
});

test('failed assignment or audit INSERT rolls back claim so safe retry can proceed', async () => {
  for(const failing of ['failAssignment','failFinalization'] as const) {
    const db=new FakeSerializedDatabase();db[failing]=true;
    assert.deepEqual(await submit(db),
      {ok:false,executed:false,reason:'transaction_failed'});
    assert.equal(db.claimKeys.size,0);
    assert.equal(db.assignments.length,0);
    assert.equal(db.receipts.length,0);
    db[failing]=false;
    assert.equal((await submit(db)).executed,true);
    assert.equal(db.assignments.length,1);
  }
});

test('request never determines title, child, deadline or parent role', async () => {
  const db=new FakeSerializedDatabase();
  const result=await submit(db,{
    title:'Fake title',studentId:'other',date:'2020-01-01',
    role:'Parent',userMetadata:{role:'Parent'},
  });
  assert.equal(result.executed,true);
  assert.equal(db.assignments.length,1);
});

test('bad request and absent bearer token never access household tables', async () => {
  const db=new FakeSerializedDatabase();
  const malformed=await submit(db,{expectedRevision:'incorrect'});
  assert.deepEqual(malformed,{ok:false,executed:false,reason:'invalid_request'});
  const missing=await executeReviewedAssignment(null,request(),db.adapter());
  assert.deepEqual(missing,{ok:false,executed:false,reason:'invalid_identity'});
  assert.equal(db.reads.membership,0);
});
