import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { eraseHouseholdCaptureStorage } from '../../api/_lib/householdCaptureStorageErasure.ts';

if (process.env.FOS_LOCAL_SUPABASE_TEST !== '1' || !process.env.FOS_LOCAL_STATUS_FILE ||
    process.env.DATABASE_URL || process.env.SUPABASE_ACCESS_TOKEN) {
  throw new Error('Requires isolated local Supabase CI');
}
const status: Record<string, string> = {};
for (const line of readFileSync(process.env.FOS_LOCAL_STATUS_FILE, 'utf8').split('\n')) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (match) status[match[1]] = match[2].replace(/^"|"$/g, '');
}
const api = new URL(status.API_URL ?? '');
const db = new URL(status.DB_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(api.hostname) ||
    !['127.0.0.1', 'localhost'].includes(db.hostname) || !status.SERVICE_ROLE_KEY) {
  throw new Error('Local Supabase target check failed');
}
const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const family = '00000000-0000-0000-0000-00000000000a';
const other = '00000000-0000-0000-0000-00000000000b';

test('local Storage API removes one household and retains another', async () => {
  const { error: bucketError } = await client.storage.createBucket('captures', { public: false });
  assert.equal(bucketError, null, bucketError?.message);
  const bucket = client.storage.from('captures');
  for (const path of [`${family}/photo.jpg`, `${family}/illustrations/a.png`, `${other}/photo.jpg`]) {
    const { error } = await bucket.upload(path, Buffer.from('synthetic capture'),
      { contentType: 'image/jpeg' });
    assert.equal(error, null, error?.message);
  }
  const listed = await bucket.listV2({ prefix: `${family}/`, with_delimiter: false });
  assert.equal(listed.error, null, listed.error?.message);
  assert.equal(listed.data?.objects.length, 2);
  assert.ok(listed.data.objects.every(object =>
    [object.key, object.name].some(value =>
      value?.startsWith(`${family}/`) || value?.startsWith(`captures/${family}/`))),
  `Local Storage returned paths in an unexpected shape: ${JSON.stringify(listed.data.objects.map(object => ({
    keyPresent: !!object.key, keyHasBucket: object.key?.startsWith('captures/'),
    keyHasFamily: object.key?.includes(family), nameHasFamily: object.name.includes(family),
    nameHasSlash: object.name.includes('/'),
  })))}`);
  assert.deepEqual(await eraseHouseholdCaptureStorage(family, bucket), { removed: 2 });
  const remaining = await bucket.listV2({ prefix: `${other}/`, with_delimiter: false });
  assert.equal(remaining.error, null, remaining.error?.message);
  assert.equal(remaining.data?.objects.length, 1);
  assert.ok([remaining.data?.objects[0].key, remaining.data?.objects[0].name].some(value =>
    value === `${other}/photo.jpg` || value === `captures/${other}/photo.jpg`));
});
