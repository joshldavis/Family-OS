import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

if (process.env.PGHOST !== 'localhost' ||
    process.env.PGDATABASE !== 'fos_uuid_workspace' || process.env.DATABASE_URL) {
  throw new Error('Erasure rehearsal requires disposable CI database');
}

const familyA = '00000000-0000-0000-0000-00000000000a';
const familyB = '00000000-0000-0000-0000-00000000000b';
const actorB = '00000000-0000-0000-0000-000000000003';
const sessionB = '00000000-0000-0000-0000-000000000103';
const sourceB = '00000000-0000-0000-0000-000000000901';
const proposalB = '00000000-0000-0000-0000-000000000902';
const reviewB = '00000000-0000-0000-0000-000000000903';
const consentTime = '2026-10-19T00:00:00.000Z';
const digest = '9'.repeat(64);
const admin = new Pool({ user: 'postgres', database: 'fos_uuid_workspace' });
const service = new Pool({ user: 'service_role', database: 'fos_uuid_workspace' });

async function counts(familyId: string) {
  const result = await admin.query(`select
    (select count(*)::int from family_os.family_sources where family_id=$1) as sources,
    (select count(*)::int from family_os.family_action_proposals where family_id=$1) as proposals,
    (select count(*)::int from family_os.school_agent_source_consents where family_id=$1) as consents,
    (select count(*)::int from family_os.school_agent_review_receipts where family_id=$1) as reviews,
    (select count(*)::int from family_os.school_agent_action_claims where family_id=$1) as claims,
    (select count(*)::int from family_os.school_agent_execution_receipts where family_id=$1) as receipts,
    (select count(*)::int from family_os.assignments where family_id=$1 and source='AI') as assignments,
    (select count(*)::int from family_os.school_agent_erasure_marks where family_id=$1) as marks`,
    [familyId]);
  return result.rows[0] as Record<string, number>;
}

test('privileged erasure rolls back on failure, then erases only one family', async () => {
  try {
    await admin.query('insert into auth.users(id) values ($1)', [actorB]);
    await admin.query('insert into auth.sessions(id,user_id) values ($1,$2)',
      [sessionB, actorB]);
    await admin.query('insert into public.profiles(user_id,current_household_id) values ($1,$2)',
      [actorB, familyB]);
    await admin.query(`insert into public.household_members(household_id,user_id,role)
      values ($1,$2,'owner')`, [familyB, actorB]);
    await admin.query(`insert into family_os.family_sources
      (id,family_id,origin_kind,source_system,source_ref_digest)
      values ($1,$2,'email','school_email',$3)`, [sourceB, familyB, digest]);
    await admin.query(`insert into family_os.school_agent_source_consents
      (family_id,source_id,status,authorized_by_auth_id,granted_at)
      values ($1,$2,'active',$3,$4)`, [familyB, sourceB, actorB, consentTime]);
    const revisionResult = await admin.query(`select family_os.school_agent_proposal_revision(
      $1::uuid,$2::uuid,$3,$4,$5::date,$6,$7::timestamptz,true,true,true) as revision`,
    [proposalB, familyB, digest, 'Other family worksheet', '2026-10-20',
      'student-b', consentTime]);
    const revision = revisionResult.rows[0].revision as string;
    await admin.query(`insert into family_os.family_action_proposals
      (id,family_id,source_id,source_ref_digest,source_revision,action_kind,
       student_id,title,due_date,consent_captured_at,status,
       title_confirmed_by_parent,student_confirmed_by_parent,date_confirmed_by_parent)
      values ($1,$2,$3,$4,$5,'create_schoolwork_assignment',
        'student-b','Other family worksheet','2026-10-20',$6,
        'approved',true,true,true)`,
    [proposalB, familyB, sourceB, digest, revision, consentTime]);
    await admin.query(`insert into family_os.school_agent_review_receipts
      (id,family_id,proposal_id,source_id,source_revision,consent_grant_version,
       decision,reviewed_by_auth_id,confirmed_title,confirmed_student_id,confirmed_due_date)
      values ($1,$2,$3,$4,$5,1,'approved',$6,
        'Other family worksheet','student-b','2026-10-20')`,
    [reviewB, familyB, proposalB, sourceB, revision, actorB]);
    const executedB = await service.query(`select public.school_agent_execute_reviewed_assignment(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid) as result`,
    [actorB, sessionB, familyB, proposalB, revision, reviewB]);
    assert.equal(executedB.rows[0].result.executed, true);

    const beforeA = await counts(familyA);
    const beforeB = await counts(familyB);
    assert.ok(beforeA.receipts > 0 && beforeB.receipts > 0);
    await assert.rejects(service.query(
      'select family_os.school_agent_erase_family($1::uuid)', [familyA]));

    await admin.query(`create function family_os.synthetic_erasure_failure()
      returns trigger language plpgsql as $$
      begin raise exception 'synthetic erasure failure'; end $$`);
    await admin.query(`create trigger synthetic_erasure_failure
      before delete on family_os.assignments for each row
      execute function family_os.synthetic_erasure_failure()`);
    await assert.rejects(admin.query(
      'select family_os.school_agent_erase_family($1::uuid)', [familyA]));
    assert.deepEqual(await counts(familyA), beforeA, 'failure must roll back all rows and mark');
    assert.deepEqual(await counts(familyB), beforeB, 'other family must remain unchanged');
    await admin.query('drop trigger synthetic_erasure_failure on family_os.assignments');

    const erased = await admin.query(
      'select family_os.school_agent_erase_family($1::uuid) as result', [familyA]);
    assert.equal(erased.rows[0].result.familyId, familyA);
    assert.ok(erased.rows[0].result.receiptsDeleted > 0);
    assert.ok(erased.rows[0].result.assignmentsDeleted > 0);
    assert.deepEqual(await counts(familyA), {
      sources: 0, proposals: 0, consents: 0, reviews: 0,
      claims: 0, receipts: 0, assignments: 0, marks: 1,
    });
    assert.deepEqual(await counts(familyB), beforeB);

    const blocked = await service.query(`select public.school_agent_execute_reviewed_assignment(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid) as result`,
    ['00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000101', familyA,
      '00000000-0000-0000-0000-000000000601', 'f'.repeat(64),
      '00000000-0000-0000-0000-000000000701']);
    assert.deepEqual(blocked.rows[0].result, {
      ok: false, executed: false, reason: 'family_erasing',
    });

    // Synthetic stand-in for the wider account deletion workflow: the
    // School Agent cleanup and household deletion share one transaction.
    const deletion = await admin.connect();
    try {
      await deletion.query('begin');
      await deletion.query('select family_os.school_agent_erase_family($1::uuid)', [familyA]);
      await deletion.query('delete from family_os.assignments where family_id=$1', [familyA]);
      await deletion.query('delete from family_os.students where family_id=$1', [familyA]);
      await deletion.query('delete from public.household_members where household_id=$1', [familyA]);
      await deletion.query('delete from public.profiles where current_household_id=$1', [familyA]);
      await deletion.query('delete from public.households where id=$1', [familyA]);
      await deletion.query('commit');
    } catch (error) {
      await deletion.query('rollback');
      throw error;
    } finally { deletion.release(); }
    const householdA = await admin.query('select 1 from public.households where id=$1', [familyA]);
    assert.equal(householdA.rowCount, 0);
    assert.equal((await counts(familyA)).marks, 0, 'household cascade removes deletion fence');
    assert.deepEqual(await counts(familyB), beforeB);
  } finally { await service.end(); await admin.end(); }
});
