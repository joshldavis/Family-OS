import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Pool, type PoolClient } from 'pg';

if (process.env.FOS_LOCAL_SUPABASE_TEST !== '1' || !process.env.FOS_LOCAL_STATUS_FILE ||
    process.env.DATABASE_URL || process.env.SUPABASE_ACCESS_TOKEN) {
  throw new Error('Requires disposable local Supabase CI');
}
const status: Record<string, string> = {};
for (const line of readFileSync(process.env.FOS_LOCAL_STATUS_FILE, 'utf8').split('\n')) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (match) status[match[1]] = match[2].replace(/^"|"$/g, '');
}
const apiUrl = new URL(status.API_URL ?? '');
const dbUrl = new URL(status.DB_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(apiUrl.hostname) ||
    !['127.0.0.1', 'localhost'].includes(dbUrl.hostname) || !status.ANON_KEY) {
  throw new Error('Local Supabase target check failed');
}
const admin = new Pool({ connectionString: status.DB_URL });
const familyA = '00000000-0000-0000-0000-0000000000a1';
const familyB = '00000000-0000-0000-0000-0000000000b1';

async function createSyntheticUser(email: string): Promise<string> {
  const client = createClient(status.API_URL, status.ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email, password: 'synthetic-Only-2026!' });
  assert.equal(error, null, error?.message);
  assert.ok(data.user?.id);
  return data.user.id;
}

async function asAuthenticated<T>(userId: string, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await admin.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, role: 'authenticated', is_anonymous: false })]);
    await client.query('set local role authenticated');
    return await callback(client);
  } finally {
    await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

test('candidate workspace protects household membership and family data', async () => {
  try {
    const owner = await createSyntheticUser('fos013-owner@example.invalid');
    const member = await createSyntheticUser('fos013-member@example.invalid');
    const outsider = await createSyntheticUser('fos013-outsider@example.invalid');
    await admin.query(`insert into public.households(id,name) values ($1,'A'),($2,'B')`, [familyA, familyB]);
    await admin.query(`insert into public.profiles(user_id,current_household_id) values ($1,$4),($2,$4),($3,$5)`,
      [owner, member, outsider, familyA, familyB]);
    await admin.query(`insert into public.household_members(household_id,user_id,role) values
      ($1,$3,'owner'),($1,$4,'member'),($2,$5,'owner')`, [familyA, familyB, owner, member, outsider]);
    await admin.query(`insert into family_os.students(id,family_id,name) values
      ('student-a1',$1,'Synthetic A'),('student-b1',$2,'Synthetic B')`, [familyA, familyB]);

    const ownerScope = await asAuthenticated(owner, client => client.query(
      'select family_os.current_family_id() as family, family_os.current_owner_family_id() as owner'));
    assert.deepEqual(ownerScope.rows[0], { family: familyA, owner: familyA });
    const memberScope = await asAuthenticated(member, client => client.query(
      'select family_os.current_family_id() as family, family_os.current_owner_family_id() as owner'));
    assert.deepEqual(memberScope.rows[0], { family: familyA, owner: null });
    const visible = await asAuthenticated(outsider, client => client.query(
      'select id from family_os.students order by id'));
    assert.deepEqual(visible.rows, [{ id: 'student-b1' }]);

    await assert.rejects(asAuthenticated(member, client => client.query(
      `update public.household_members set role='owner' where household_id=$1 and user_id=$2`,
      [familyA, member])), { code: '42501' });
    await assert.rejects(asAuthenticated(member, client => client.query(
      'update public.households set is_demo=true where id=$1', [familyA])), { code: '42501' });
    await assert.rejects(asAuthenticated(member, client => client.query(
      `insert into family_os.students(id,family_id,name) values ('member-insert',$1,'Synthetic')`,
      [familyA])), { code: '42501' });
    const forgedScope = await asAuthenticated(member, async client => {
      await client.query('update public.profiles set current_household_id=$1 where user_id=$2',
        [familyB, member]);
      return client.query(`select family_os.current_family_id() as family,
        (select count(*)::int from family_os.students) as visible`);
    });
    assert.deepEqual(forgedScope.rows[0], { family: null, visible: 0 });
  } finally { await admin.end(); }
});
