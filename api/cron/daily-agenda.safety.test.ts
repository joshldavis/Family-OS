import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from './daily-agenda.ts';

test('agenda cannot contact a database or model before the release review', async () => {
  const names = ['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY'];
  const saved = new Map(names.map(name => [name, process.env[name]]));
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
    process.env.GEMINI_API_KEY = 'synthetic-model-key';
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected network request'); };
    const unauthorized = await handler(new Request('https://example.invalid/api/cron/daily-agenda'));
    assert.equal(unauthorized.status, 401);
    const response = await handler(new Request('https://example.invalid/api/cron/daily-agenda', {
      headers: { authorization: 'Bearer synthetic-cron-secret' },
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Daily agenda is disabled pending database review.' });
    assert.equal(calls, 0);
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    assert.ok(!config.crons?.some((cron: { path: string }) => cron.path === '/api/cron/daily-agenda'));
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
