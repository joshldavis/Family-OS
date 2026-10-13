import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBearerToken, verifyBearerIdentity } from './verifiedIdentity.ts';

const token = 'example-authenticated-jwt-token-12345';
const valid = {
  getUser: async (received: string) => {
    assert.equal(received, token);
    return {
      data: { user: { id: 'auth-123', email: 'parent@example.org', email_confirmed_at: '2026-10-13T00:00:00Z' } },
      error: null,
    };
  },
};

test('parseBearerToken rejects malformed, absent and oversized headers', () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken('Basic abcdef1234567890'), null);
  assert.equal(parseBearerToken('Bearer abc'), null);
  assert.equal(parseBearerToken('Bearer ' + token + ' invalid'), null);
  assert.equal(parseBearerToken('Bearer ' + 'x'.repeat(9000)), null);
  assert.equal(parseBearerToken('Bearer ' + token), token);
});

test('verified auth identity succeeds after remote Auth verification', async () => {
  assert.deepEqual(await verifyBearerIdentity('Bearer ' + token, valid), {
    ok: true, authUserId: 'auth-123',
  });
});

test('missing bearer credentials never reach the auth verifier', async () => {
  assert.deepEqual(await verifyBearerIdentity(undefined, {
    getUser: async () => { throw new Error('verifier must not run'); },
  }), { ok: false, reason: 'missing_token' });
});

test('invalid bearer credentials are denied', async () => {
  const invalid = {
    getUser: async () => ({
      data: { user: null },
      error: { message: 'JWT is invalid' },
    }),
  };
  assert.deepEqual(await verifyBearerIdentity('Bearer ' + token, invalid), {
    ok: false, reason: 'invalid_token',
  });
});

test('unconfirmed and anonymous accounts cannot enter trusted membership workflows', async () => {
  for (const candidate of [
    { id: 'u1', email: 'a@example.com' },
    { id: 'u2', email: 'b@example.com', is_anonymous: true, email_confirmed_at: '2026-10-13T00:00:00Z' },
    { id: 'u3', email_confirmed_at: '2026-10-13T00:00:00Z' },
    { id: 'u4', email: 'unverified@example.org', confirmed_at: '2026-10-13T00:00:00Z' },
  ]) {
    const auth = { getUser: async () => ({ data: { user: candidate }, error: null }) };
    assert.deepEqual(await verifyBearerIdentity('Bearer ' + token, auth), {
      ok: false, reason: 'unverified_identity',
    });
  }
});

test('auth provider failure denies access without exposing messages', async () => {
  const auth = { getUser: async () => { throw new Error('secret backend message'); } };
  assert.deepEqual(await verifyBearerIdentity('Bearer ' + token, auth), {
    ok: false, reason: 'auth_unavailable',
  });
});
