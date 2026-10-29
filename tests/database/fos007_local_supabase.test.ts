import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { trustedProposalRevision, type TrustedSchoolProposal } from
  '../../api/_lib/schoolAgentApprovalPreview.ts';
import { executeReviewedAssignmentViaRpc } from
  '../../api/_lib/schoolAgentRpcExecutor.ts';

if (process.env.FOS_LOCAL_SUPABASE_TEST !== '1' || !process.env.FOS_LOCAL_STATUS_FILE ||
    process.env.DATABASE_URL) throw new Error('Requires isolated local Supabase CI');

function localStatus(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return values;
}

const status = localStatus(process.env.FOS_LOCAL_STATUS_FILE);
const apiUrl = new URL(status.API_URL ?? '');
const dbUrl = new URL(status.DB_URL ?? '');
if (!['127.0.0.1','localhost'].includes(apiUrl.hostname) ||
    !['127.0.0.1','localhost'].includes(dbUrl.hostname) ||
    !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
  throw new Error('Local Supabase target check failed');
}
const admin = new Pool({ connectionString: status.DB_URL });
const anon = createClient(status.API_URL, status.ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const authVerifier = createClient(status.API_URL, status.SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });

const familyId = '00000000-0000-0000-0000-00000000000a';
const sourceId = '00000000-0000-0000-0000-000000000501';
const proposalId = '00000000-0000-0000-0000-000000000601';
const approvalId = '00000000-0000-0000-0000-000000000701';
const digest = '1'.padStart(64, '0');
const consentTime = '2026-10-19T00:00:00.000Z';

test('local Supabase Auth and Data API enforce the server-only RPC boundary', async () => {
  try {
    const { data: signedUp, error: signUpError } = await anon.auth.signUp({
      email: 'fos007-local@example.invalid', password: 'synthetic-Only-2026!',
    });
    assert.equal(signUpError, null, signUpError?.message);
    assert.ok(signedUp.user?.id);
    assert.ok(signedUp.session?.access_token);
    const actorId = signedUp.user.id;
    const token = signedUp.session.access_token;
    const authorization = `Bearer ${token}`;

    await admin.query(`insert into public.households(id) values ($1)`, [familyId]);
    await admin.query(`insert into family_os.students(id,family_id)
      values ('student-a',$1)`, [familyId]);
    await admin.query(`insert into public.profiles(user_id,current_household_id)
      values ($1,$2)`, [actorId, familyId]);
    await admin.query(`insert into public.household_members(household_id,user_id,role)
      values ($1,$2,'owner')`, [familyId, actorId]);

    const proposal: Omit<TrustedSchoolProposal, 'revision'> = {
      id: proposalId, familyId, sourceSystem: 'school_email',
      sourceRefDigest: digest, kind: 'assignment', title: 'Local Auth worksheet',
      date: '2026-10-20', studentId: 'student-a',
      reviewStatus: 'ready_for_review', consentCapturedAt: consentTime,
      consentStatus: 'active', titleConfirmedByParent: true,
      studentConfirmedByParent: true, dateConfirmedByParent: true,
    };
    const expectedRevision = trustedProposalRevision(proposal);
    await admin.query(`insert into family_os.family_sources
      (id,family_id,origin_kind,source_system,source_ref_digest)
      values ($1,$2,'email','school_email',$3)`, [sourceId,familyId,digest]);
    await admin.query(`insert into family_os.school_agent_source_consents
      (family_id,source_id,status,authorized_by_auth_id,granted_at)
      values ($1,$2,'active',$3,$4)`, [familyId,sourceId,actorId,consentTime]);
    await admin.query(`insert into family_os.family_action_proposals
      (id,family_id,source_id,source_ref_digest,source_revision,action_kind,
       student_id,title,due_date,consent_captured_at,status,
       title_confirmed_by_parent,student_confirmed_by_parent,date_confirmed_by_parent)
      values ($1,$2,$3,$4,$5,'create_schoolwork_assignment',
       'student-a','Local Auth worksheet','2026-10-20',$6,
       'approved',true,true,true)`,
    [proposalId,familyId,sourceId,digest,expectedRevision,consentTime]);
    await admin.query(`insert into family_os.school_agent_review_receipts
      (id,family_id,proposal_id,source_id,source_revision,
       consent_grant_version,decision,reviewed_by_auth_id,
       confirmed_title,confirmed_student_id,confirmed_due_date)
      values ($1,$2,$3,$4,$5,1,'approved',$6,
       'Local Auth worksheet','student-a','2026-10-20')`,
    [approvalId,familyId,proposalId,sourceId,expectedRevision,actorId]);

    const params = {
      p_actor_auth_id: actorId, p_session_id: JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).session_id,
      p_family_id: familyId, p_proposal_id: proposalId,
      p_expected_revision: expectedRevision, p_approval_id: approvalId,
    };
    const anonAttempt = await anon.rpc('school_agent_execute_reviewed_assignment', params);
    assert.ok(anonAttempt.error, 'anon RPC must be denied');
    const signedInAttempt = await fetch(`${status.API_URL}/rest/v1/rpc/school_agent_execute_reviewed_assignment`, {
      method: 'POST', headers: { apikey: status.ANON_KEY,
        Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    assert.ok(!signedInAttempt.ok, 'authenticated RPC must be denied');
    const privateSchemaAttempt = await fetch(`${status.API_URL}/rest/v1/students?select=id`, {
      headers: { apikey: status.ANON_KEY,
        Authorization: authorization, 'Accept-Profile': 'family_os' },
    });
    assert.ok(!privateSchemaAttempt.ok, 'private schema must not be exposed');

    const adapters = { auth: { getUser: (jwt: string) => authVerifier.auth.getUser(jwt) },
      call: async (args: typeof params) => {
        const { data, error } = await service.rpc(
          'school_agent_execute_reviewed_assignment', args);
        return { data, error };
      } };
    const request = { familyId, proposalId, approvalId, expectedRevision };
    const first = await executeReviewedAssignmentViaRpc(authorization, request, adapters);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.executed, true, JSON.stringify(first));
    const repeated = await executeReviewedAssignmentViaRpc(authorization, request, adapters);
    assert.deepEqual(repeated, { ok: true, executed: false,
      reason: 'already_executed', familyId });

    // Keep the RPC transaction open after it locks the real Auth session.
    // Global sign-out must wait until this action transaction completes.
    const actionTx = await admin.connect();
    let pendingSignOut: ReturnType<typeof service.auth.admin.signOut> | undefined;
    try {
      await actionTx.query('begin');
      await actionTx.query("set local idle_in_transaction_session_timeout = '15s'");
      await actionTx.query('set local role service_role');
      const held = await actionTx.query(`select public.school_agent_execute_reviewed_assignment(
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid) as result`,
      [params.p_actor_auth_id, params.p_session_id, params.p_family_id,
        params.p_proposal_id, params.p_expected_revision, params.p_approval_id]);
      assert.deepEqual(held.rows[0].result, {
        ok: true, executed: false, reason: 'already_executed', familyId,
      });
      const actionPid = (await actionTx.query('select pg_backend_pid() as pid')).rows[0].pid as number;
      pendingSignOut = service.auth.admin.signOut(token, 'global');
      void pendingSignOut.catch(() => undefined);
      let blocked = false;
      for (let attempt = 0; attempt < 160; attempt++) {
        const waiting = await admin.query(`select exists (
          select 1 from pg_catalog.pg_stat_activity
          where pid <> $1 and $1::int = any(pg_catalog.pg_blocking_pids(pid))
        ) as blocked`, [actionPid]);
        if (waiting.rows[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(blocked, true, 'Auth sign-out must wait for the action session lock');
      await actionTx.query('commit');
      const signOut = await pendingSignOut;
      assert.equal(signOut.error, null, signOut.error?.message);
    } finally {
      await actionTx.query('rollback').catch(() => undefined);
      if (pendingSignOut) await pendingSignOut.catch(() => undefined);
      actionTx.release();
    }
    const revoked = await executeReviewedAssignmentViaRpc(authorization, request, adapters);
    assert.deepEqual(revoked, { ok: false, executed: false, reason: 'invalid_identity' });
    const directRevoked = await service.rpc('school_agent_execute_reviewed_assignment', params);
    assert.equal(directRevoked.error, null);
    assert.deepEqual(directRevoked.data, {
      ok: false, executed: false, reason: 'inactive_session',
    });
    const counts = await admin.query(`select
      (select count(*)::int from family_os.assignments
       where title='Local Auth worksheet') as assignments,
      (select count(*)::int from family_os.school_agent_execution_receipts) as receipts`);
    assert.deepEqual(counts.rows[0], { assignments: 1, receipts: 1 });
    const erased = await admin.query(
      'select family_os.school_agent_erase_family($1::uuid) as result', [familyId]);
    assert.equal(erased.rows[0].result.familyId, familyId);
    const after = await admin.query(`select
      (select count(*)::int from family_os.family_sources where family_id=$1) as sources,
      (select count(*)::int from family_os.family_action_proposals where family_id=$1) as proposals,
      (select count(*)::int from family_os.school_agent_review_receipts where family_id=$1) as reviews,
      (select count(*)::int from family_os.school_agent_action_claims where family_id=$1) as claims,
      (select count(*)::int from family_os.school_agent_execution_receipts where family_id=$1) as receipts,
      (select count(*)::int from family_os.assignments where family_id=$1) as assignments,
      (select count(*)::int from family_os.school_agent_erasure_marks where family_id=$1) as marks`,
    [familyId]);
    assert.deepEqual(after.rows[0], {
      sources: 0, proposals: 0, reviews: 0, claims: 0,
      receipts: 0, assignments: 0, marks: 1,
    });
  } finally { await admin.end(); }
});
