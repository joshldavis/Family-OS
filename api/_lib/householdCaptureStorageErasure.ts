/** Server-only cleanup for the private captures bucket. Supply an already authorized client. */
type StorageResult<T> = Promise<{ data: T; error: null } | { data: null; error: { message: string } }>;
type StorageBucket = {
  listV2(options: { prefix: string; limit: number; with_delimiter: false; cursor?: string }):
    StorageResult<{ objects: Array<{ key?: string; name: string }>; hasNext: boolean; nextCursor?: string }>;
  remove(paths: string[]): StorageResult<unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;
const MAX_OBJECTS = 100_000;

async function listHouseholdPaths(bucket: StorageBucket, prefix: string): Promise<string[]> {
  const paths = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await bucket.listV2({ prefix, limit: PAGE_SIZE, with_delimiter: false, cursor });
    if (result.error || !result.data) throw new Error('Capture Storage listing failed');
    for (const object of result.data.objects) {
      // Only the full key proves the object belongs to this exact household prefix.
      // Storage list-v2 keys can include the bucket name; remove() takes a bucket-relative path.
      const fullPath = object.key ?? object.name;
      const path = fullPath.startsWith('captures/')
        ? fullPath.slice('captures/'.length) : fullPath;
      if (!path || !path.startsWith(prefix) || path === prefix) {
        throw new Error('Capture Storage returned an unsafe object path');
      }
      paths.add(path);
      if (paths.size > MAX_OBJECTS) throw new Error('Capture Storage object limit exceeded');
    }
    if (!result.data.hasNext) break;
    const next = result.data.nextCursor;
    if (!next || cursors.has(next)) throw new Error('Capture Storage pagination failed');
    cursors.add(next);
    cursor = next;
  } while (true);
  return [...paths];
}

export async function eraseHouseholdCaptureStorage(
  householdId: string, bucket: StorageBucket,
): Promise<{ removed: number }> {
  if (!UUID.test(householdId)) throw new Error('Invalid household ID');
  const prefix = `${householdId.toLowerCase()}/`;
  const paths = await listHouseholdPaths(bucket, prefix);
  for (let offset = 0; offset < paths.length; offset += PAGE_SIZE) {
    const batch = paths.slice(offset, offset + PAGE_SIZE);
    const result = await bucket.remove(batch);
    if (result.error) throw new Error('Capture Storage removal failed');
  }
  if ((await listHouseholdPaths(bucket, prefix)).length !== 0) {
    throw new Error('Capture Storage still contains household objects');
  }
  return { removed: paths.length };
}
