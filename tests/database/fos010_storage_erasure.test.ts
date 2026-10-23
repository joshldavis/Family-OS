import test from 'node:test';
import assert from 'node:assert/strict';
import { eraseHouseholdCaptureStorage } from '../../api/_lib/householdCaptureStorageErasure.ts';

const family = '00000000-0000-0000-0000-00000000000a';
const other = '00000000-0000-0000-0000-00000000000b';

test('removes paginated household objects and nested illustrations only', async () => {
  const objects = new Set([`${family}/photo.jpg`, `${family}/illustrations/a.png`, `${other}/photo.jpg`]);
  const removed: string[][] = [];
  const bucket = {
    async listV2({ prefix, cursor }: { prefix: string; cursor?: string }) {
      const matching = [...objects].filter(path => path.startsWith(prefix)).sort();
      const index = cursor ? Number(cursor) : 0;
      return { data: { objects: matching.slice(index, index + 1).map(key => ({ key, name: key.split('/').pop()! })),
        hasNext: index + 1 < matching.length, nextCursor: String(index + 1) }, error: null };
    },
    async remove(paths: string[]) { removed.push(paths); paths.forEach(path => objects.delete(path));
      return { data: [], error: null }; },
  };
  assert.deepEqual(await eraseHouseholdCaptureStorage(family, bucket), { removed: 2 });
  assert.deepEqual([...objects], [`${other}/photo.jpg`]);
  assert.deepEqual(removed.flat().sort(), [`${family}/illustrations/a.png`, `${family}/photo.jpg`]);
});

test('rejects a listing that escapes the exact household prefix before removal', async () => {
  let removed = false;
  const bucket = {
    async listV2() { return { data: { objects: [{ key: `${other}/photo.jpg`, name: 'photo.jpg' }],
      hasNext: false }, error: null }; },
    async remove() { removed = true; return { data: [], error: null }; },
  };
  await assert.rejects(eraseHouseholdCaptureStorage(family, bucket), /unsafe object path/);
  assert.equal(removed, false);
});
