import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { trustedProposalRevision, type TrustedSchoolProposal } from '../../api/_lib/schoolAgentApprovalPreview.ts';
import { executeReviewedAssignment } from '../../api/_lib/schoolAgentApprovalTransaction.ts';
import { createSchoolAgentPostgresAdapters } from '../../api/_lib/schoolAgentPostgresAdapter.ts';

if (process.env.PGHOST !== 'localhost' || process.env.PGDATABASE !== 'fos_uuid_workspace' ||
    process.env.DATABASE_URL) throw new Error('Adapter test requires disposable CI database');

const familyId = '00000000-0000-0000-0000-00000000000a';
const otherFamily = '00000000-0000-0000-0000-00000000000b';
const actorId = '00000000-0000-0000-0000-000000000001';
const otherActorId = '00000000-0000-0000-0000-000000000002';
const activeSessionId = '00000000-0000-0000-0000-000000000101';
const expiredSessionId = '00000000-0000-0000-0000-000000000102';
const consentTime = '2026-10-19T00:00:00.000Z';
const admin = new Pool({ user: 'postgres', database: 'fos_uuid_workspace' });
const service = new Pool({ user: 'service_role', database: 'fos_uuid_workspace' });

function bearer(sessionId: string): string {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId })).toString('base64url');
  return `Bearer eyJhbGciOiJub25lIn0.${payload}.synthetic-signature`;
}
const activeBearer = bearer(activeSessionId);
const expiredBearer = bearer(expiredSessionId);

const sqlStates: string[] = [];
const adapters = createSchoolAgentPostgresAdapters({
  getUser: async token => ({
    data: { user: token === activeBearer.slice(7) || token === expiredBearer.slice(7) ? {
      id: actorId, email: 'synthetic@example.invalid',
      email_confirmed_at: consentTime, is_anonymous: false,
    } : null }, error: null,
  }),
}, service, code => sqlStates.push(code));

async function seed(index: number, title: string) {
  const sourceId = `00000000-0000-0000-0000-${String(200 + index).padStart(12, '0')}`;
  const proposalId = `00000000-0000-0000-0000-${String(300 + index).padStart(12, '0')}`;
  const approvalId = `00000000-0000-0000-0000-${String(400 + index).padStart(12, '0')}`;
  const digest = index.toString(16).padStart(64, '0');
  const data: Omit<TrustedSchoolProposal, 'revision'> = {
    id: proposalId, familyId, sourceSystem: 'school_email',
    sourceRefDigest: digest, kind: 'assignment', title,
    date: '2026-10-20', studentId: 'student-a', reviewStatus: 'ready_for_review',
    consentCapturedAt: consentTime, consentStatus: 'active',
    titleConfirmedByParent: true, studentConfirmedByParent: true,
    dateConfirmedByParent: true,
  };
  const revision = trustedProposalRevision(data);
  await admin.query(`
    insert into family_os.family_sources
      (id,family_id,origin_kind,source_system,source_ref_digest)
    values ($1,$2,'email','school_email',$3)`, [sourceId, familyId, digest]);
  await admin.query(`
    insert into family_os.school_agent_source_consents
      (family_id,source_id,status,authorized_by_auth_id,granted_at)
    values ($1,$2,'active',$3,$4)`, [familyId, sourceId, actorId, consentTime]);
  await admin.query(`
    insert into family_os.family_action_proposals
      (id,family_id,source_id,source_ref_digest,source_revision,action_kind,
       student_id,title,due_date,consent_captured_at,status,
       title_confirmed_by_parent,student_confirmed_by_parent,date_confirmed_by_parent)
    values ($1,$2,$3,$4,$5,'create_schoolwork_assignment',
      'student-a',$6,'2026-10-20',$7,'approved',true,true,true)`,
    [proposalId, familyId, sourceId, digest, revision, title, consentTime]);
  await admin.query(`
    insert into family_os.school_agent_review_receipts
      (id,family_id,proposal_id,source_id,source_revision,
       consent_grant_version,decision,
       reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
    values ($1,$2,$3,$4,$5,1,'approved',$6,$7,'student-a','2026-10-20')`,
    [approvalId, familyId, proposalId, sourceId, revision, actorId, title]);
  return { familyId, proposalId, approvalId, expectedRevision: revision, sourceId };
}

test('server adapter commits once, denies other families and expired sessions', async () => {
  try {
    const request = await seed(1, 'Library worksheet');
    const first = await executeReviewedAssignment(activeBearer, request, adapters);
    assert.equal(first.ok, true, JSON.stringify({ first, sqlStates }));
    assert.equal(first.executed, true, JSON.stringify(first));
    const second = await executeReviewedAssignment(activeBearer, request, adapters);
    assert.deepEqual(second, { ok: true, executed: false,
      reason: 'already_executed', familyId });
    await assert.rejects(service.query(`
      update family_os.school_agent_review_receipts
      set decision='withdrawn' where id=$1`, [request.approvalId]), { code: '42501' });
    await assert.rejects(service.query(`
      delete from family_os.school_agent_review_receipts where id=$1`,
      [request.approvalId]), { code: '42501' });
    await admin.query(`
      insert into family_os.assignments
        (id,family_id,student_id,title,due_date,source)
      values ('school:synthetic-alternate',$1,'student-a',
        'Alternate assignment','2026-10-20','manual')`, [familyId]);
    const executedClaim = await admin.query(`
      select id::text, source_revision
      from family_os.school_agent_action_claims where proposal_id=$1`,
      [request.proposalId]);
    assert.equal(executedClaim.rows[0].source_revision, request.expectedRevision);
    await assert.rejects(service.query(`
      update family_os.school_agent_action_claims
      set created_at=created_at + interval '1 second' where id=$1`,
      [executedClaim.rows[0].id]), { code: 'P0001' });
    await assert.rejects(admin.query(`
      update family_os.school_agent_execution_receipts
      set assignment_id='school:synthetic-alternate' where claim_id=$1`,
      [executedClaim.rows[0].id]), { code: '23503' });
    await assert.rejects(admin.query(`
      update family_os.school_agent_execution_receipts
      set source_revision=$1 where claim_id=$2`,
      ['f'.repeat(64), executedClaim.rows[0].id]), { code: '23503' });
    await admin.query('insert into auth.users(id) values ($1)', [otherActorId]);
    await admin.query(`
      insert into public.profiles(user_id,current_household_id)
      values ($1,$2)`, [otherActorId, familyId]);
    await admin.query(`
      insert into public.household_members(household_id,user_id,role)
      values ($1,$2,'member')`, [familyId, otherActorId]);
    await assert.rejects(admin.query(`
      update family_os.school_agent_execution_receipts
      set actor_auth_user_id=$1 where claim_id=$2`,
      [otherActorId, executedClaim.rows[0].id]), { code: '23503' });
    const denied = await executeReviewedAssignment(activeBearer,
      { ...request, familyId: otherFamily }, adapters);
    assert.deepEqual(denied, { ok: false, executed: false, reason: 'membership_denied' });
    const another = await seed(2, 'Science worksheet');
    await assert.rejects(service.query(`
      delete from family_os.school_agent_source_consents where source_id=$1`,
      [another.sourceId]), { code: '42501' });
    await assert.rejects(service.query(`
      update family_os.family_action_proposals
      set consent_grant_version=consent_grant_version + 1 where id=$1`,
      [another.proposalId]), { code: 'P0001' });
    const expired = await executeReviewedAssignment(expiredBearer, another, adapters);
    assert.deepEqual(expired, { ok: false, executed: false, reason: 'inactive_session' });
    const stale = await executeReviewedAssignment(activeBearer,
      { ...another, expectedRevision: 'f'.repeat(64) }, adapters);
    assert.deepEqual(stale, { ok: false, executed: false, reason: 'stale_source' });
    await admin.query(`
      update family_os.school_agent_source_consents
      set status='revoked', revoked_at=now() where source_id=$1`, [another.sourceId]);
    const revoked = await executeReviewedAssignment(activeBearer, another, adapters);
    assert.equal(revoked.executed, false);
    assert.equal(revoked.ok, false);
    await admin.query(`
      update family_os.school_agent_source_consents
      set status='active', revoked_at=null, granted_at=now()
      where source_id=$1`, [another.sourceId]);
    const regranted = await executeReviewedAssignment(activeBearer, another, adapters);
    assert.equal(regranted.executed, false);
    assert.equal(regranted.ok, false);
    const regrantState = await admin.query(`
      select c.grant_version::int as grant_version,
        (select count(*)::int from family_os.school_agent_action_claims
         where source_id=$1) as claims
      from family_os.school_agent_source_consents c where c.source_id=$1`,
      [another.sourceId]);
    assert.deepEqual(regrantState.rows[0], { grant_version: 3, claims: 0 });
    const counts = await admin.query(`
      select (select count(*)::int from family_os.assignments where title='Library worksheet') as assignments,
        (select count(*)::int from family_os.school_agent_execution_receipts) as receipts`);
    assert.deepEqual(counts.rows[0], { assignments: 1, receipts: 1 });

    await assert.rejects(service.query('select id from auth.sessions limit 1'));
    await admin.query(`
      create function family_os.synthetic_assignment_failure()
      returns trigger language plpgsql as $$
      begin
        if new.title = 'Injected failure' then
          raise exception 'synthetic assignment failure';
        end if;
        return new;
      end $$`);
    await admin.query(`
      create trigger synthetic_assignment_failure before insert on family_os.assignments
      for each row execute function family_os.synthetic_assignment_failure()`);
    const failing = await seed(3, 'Injected failure');
    const failed = await executeReviewedAssignment(activeBearer, failing, adapters);
    assert.deepEqual(failed, { ok: false, executed: false, reason: 'transaction_failed' });
    const failedCounts = await admin.query(`
      select (select count(*)::int from family_os.assignments where title='Injected failure') as assignments,
        (select count(*)::int from family_os.school_agent_action_claims where source_id=$1) as claims,
        (select count(*)::int from family_os.school_agent_execution_receipts where source_revision=$2) as receipts`,
      [failing.sourceId, failing.expectedRevision]);
    assert.deepEqual(failedCounts.rows[0], { assignments: 0, claims: 0, receipts: 0 });

    const parallel = await seed(4, 'Parallel assignment');
    const results = await Promise.all(Array.from({ length: 5 },
      () => executeReviewedAssignment(activeBearer, parallel, adapters)));
    assert.equal(results.filter(result => result.executed).length, 1);
    assert.equal(results.filter(result => result.ok && !result.executed).length, 4,
      JSON.stringify({ results, sqlStates }));
    const parallelCounts = await admin.query(`
      select (select count(*)::int from family_os.assignments where title='Parallel assignment') as assignments,
        (select count(*)::int from family_os.school_agent_action_claims where source_id=$1) as claims,
        (select count(*)::int from family_os.school_agent_execution_receipts where source_revision=$2) as receipts`,
      [parallel.sourceId, parallel.expectedRevision]);
    assert.deepEqual(parallelCounts.rows[0], { assignments: 1, claims: 1, receipts: 1 });
  } finally { await service.end(); await admin.end(); }
});
