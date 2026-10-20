import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { trustedProposalRevision, type TrustedSchoolProposal } from '../../api/_lib/schoolAgentApprovalPreview.ts';

if (process.env.PGHOST !== 'localhost' || process.env.PGDATABASE !== 'fos_uuid_workspace' ||
    process.env.DATABASE_URL) throw new Error('RPC test requires disposable CI database');

const familyId = '00000000-0000-0000-0000-00000000000a';
const otherFamily = '00000000-0000-0000-0000-00000000000b';
const actorId = '00000000-0000-0000-0000-000000000001';
const activeSessionId = '00000000-0000-0000-0000-000000000101';
const expiredSessionId = '00000000-0000-0000-0000-000000000102';
const consentTime = '2026-10-19T00:00:00.000Z';
const admin = new Pool({ user: 'postgres', database: 'fos_uuid_workspace' });
const service = new Pool({ user: 'service_role', database: 'fos_uuid_workspace' });

type Request = { familyId: string; proposalId: string; approvalId: string;
  expectedRevision: string; sourceId: string };

async function execute(request: Request, sessionId = activeSessionId) {
  const result = await service.query(`
    select public.school_agent_execute_reviewed_assignment(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid) as result`,
    [actorId, sessionId, request.familyId, request.proposalId,
      request.expectedRevision, request.approvalId]);
  return result.rows[0].result as Record<string, unknown>;
}

async function seed(index: number, title: string): Promise<Request> {
  const sourceId = `00000000-0000-0000-0000-${String(500 + index).padStart(12, '0')}`;
  const proposalId = `00000000-0000-0000-0000-${String(600 + index).padStart(12, '0')}`;
  const approvalId = `00000000-0000-0000-0000-${String(700 + index).padStart(12, '0')}`;
  const digest = index.toString(16).padStart(64, '0');
  const data: Omit<TrustedSchoolProposal, 'revision'> = {
    id: proposalId, familyId, sourceSystem: 'school_email',
    sourceRefDigest: digest, kind: 'assignment', title,
    date: '2026-10-20', studentId: 'student-a', reviewStatus: 'ready_for_review',
    consentCapturedAt: consentTime, consentStatus: 'active',
    titleConfirmedByParent: true, studentConfirmedByParent: true,
    dateConfirmedByParent: true,
  };
  const expectedRevision = trustedProposalRevision(data);
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
    [proposalId, familyId, sourceId, digest, expectedRevision, title, consentTime]);
  await admin.query(`
    insert into family_os.school_agent_review_receipts
      (id,family_id,proposal_id,source_id,source_revision,
       consent_grant_version,decision,
       reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
    values ($1,$2,$3,$4,$5,1,'approved',$6,$7,'student-a','2026-10-20')`,
    [approvalId, familyId, proposalId, sourceId, expectedRevision, actorId, title]);
  return { familyId, proposalId, approvalId, expectedRevision, sourceId };
}

test('service-only atomic RPC preserves approval checks and one assignment', async () => {
  try {
    const grants = await admin.query(`
      select has_function_privilege('service_role',
        'public.school_agent_execute_reviewed_assignment(uuid,uuid,uuid,uuid,text,uuid)',
        'EXECUTE') as service,
        has_function_privilege('anon',
        'public.school_agent_execute_reviewed_assignment(uuid,uuid,uuid,uuid,text,uuid)',
        'EXECUTE') as anon,
        has_function_privilege('authenticated',
        'public.school_agent_execute_reviewed_assignment(uuid,uuid,uuid,uuid,text,uuid)',
        'EXECUTE') as authenticated`);
    assert.deepEqual(grants.rows[0], { service: true, anon: false, authenticated: false });

    const vector = await seed(1, 'Read "é" & 🐢');
    const sqlRevision = await service.query(`
      select family_os.school_agent_proposal_revision(
        $1::uuid,$2::uuid,$3,$4,$5::date,$6,$7::timestamptz,true,true,true)
        as revision`, [vector.proposalId, familyId, '1'.padStart(64, '0'),
        'Read "é" & 🐢', '2026-10-20', 'student-a', consentTime]);
    assert.equal(sqlRevision.rows[0].revision, vector.expectedRevision);
    const sqlDigest = await service.query(`
      select family_os.school_agent_action_digest($1::uuid,$2::uuid) as digest`,
      [familyId, vector.sourceId]);
    assert.equal(sqlDigest.rows[0].digest, createHash('sha256').update(JSON.stringify([
      'fos-004-v1', familyId, vector.sourceId, 'create_schoolwork_assignment',
    ])).digest('hex'));

    const first = await execute(vector);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.executed, true, JSON.stringify(first));
    const repeated = await execute(vector);
    assert.deepEqual(repeated, { ok: true, executed: false,
      reason: 'already_executed', familyId });
    assert.deepEqual(await execute({ ...vector, familyId: otherFamily }), {
      ok: false, executed: false, reason: 'membership_denied',
    });

    const second = await seed(2, 'Science RPC');
    assert.deepEqual(await execute(second, expiredSessionId), {
      ok: false, executed: false, reason: 'inactive_session',
    });
    assert.deepEqual(await execute({ ...second, expectedRevision: 'f'.repeat(64) }), {
      ok: false, executed: false, reason: 'stale_source',
    });
    await admin.query(`
      update family_os.school_agent_source_consents
      set status='revoked', revoked_at=now() where source_id=$1`, [second.sourceId]);
    assert.deepEqual(await execute(second), {
      ok: false, executed: false, reason: 'consent_denied',
    });
    await admin.query(`
      update family_os.school_agent_source_consents
      set status='active', revoked_at=null, granted_at=now()
      where source_id=$1`, [second.sourceId]);
    assert.deepEqual(await execute(second), {
      ok: false, executed: false, reason: 'consent_denied',
    });

    await admin.query(`
      create function family_os.synthetic_rpc_assignment_failure()
      returns trigger language plpgsql as $$
      begin
        if new.title = 'RPC forced failure' then
          raise exception 'synthetic RPC assignment failure';
        end if;
        return new;
      end $$`);
    await admin.query(`
      create trigger synthetic_rpc_assignment_failure before insert on family_os.assignments
      for each row execute function family_os.synthetic_rpc_assignment_failure()`);
    const failing = await seed(3, 'RPC forced failure');
    await assert.rejects(execute(failing));
    const rolledBack = await admin.query(`
      select (select count(*)::int from family_os.assignments
              where title='RPC forced failure') as assignments,
        (select count(*)::int from family_os.school_agent_action_claims
         where source_id=$1) as claims`, [failing.sourceId]);
    assert.deepEqual(rolledBack.rows[0], { assignments: 0, claims: 0 });

    const parallel = await seed(4, 'Parallel RPC');
    const results = await Promise.all(Array.from({ length: 5 }, () => execute(parallel)));
    assert.equal(results.filter(x => x.executed).length, 1, JSON.stringify(results));
    assert.equal(results.filter(x => x.reason === 'already_executed').length, 4,
      JSON.stringify(results));
    const counts = await admin.query(`
      select (select count(*)::int from family_os.assignments
              where title='Parallel RPC') as assignments,
        (select count(*)::int from family_os.school_agent_action_claims
         where source_id=$1) as claims,
        (select count(*)::int from family_os.school_agent_execution_receipts
         where source_revision=$2) as receipts`,
      [parallel.sourceId, parallel.expectedRevision]);
    assert.deepEqual(counts.rows[0], { assignments: 1, claims: 1, receipts: 1 });
  } finally { await service.end(); await admin.end(); }
});
