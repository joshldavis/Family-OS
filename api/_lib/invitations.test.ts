import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareInvitation, invitationTokenDigest, invitationEmailDigest,
  recipientMatchesInvitation, constantTimeDigestMatch, normalizeInvitationEmail,
} from './invitations.ts';

const pepper = 'this-is-a-nonproduction-test-pepper-and-must-not-be-used';
const attrs = {
  familyId: 'family-a',
  inviterAuthUserId: 'trusted-inviter-uid',
  recipientEmail: 'Adult@Example.Org',
  intendedRole: 'parent' as const,
  ttlHours: 24,
};

test('invite secrets are random and only HMAC digests are intended to be stored', () => {
  const a = prepareInvitation(attrs, pepper, new Date('2026-10-13T12:00:00Z'));
  const b = prepareInvitation(attrs, pepper, new Date('2026-10-13T12:00:00Z'));
  assert.match(a.secret, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.secret, b.secret);
  assert.notEqual(a.tokenDigest, b.tokenDigest);
  assert.match(a.tokenDigest, /^[0-9a-f]{64}$/);
  assert.match(a.recipientEmailDigest, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify({ ...a, secret: undefined }).includes('Adult@Example.Org'));
  assert.equal(a.expiresAt, '2026-10-14T12:00:00.000Z');
});

test('invitation tokens require the correct pepper and a valid 256-bit secret', () => {
  const a = prepareInvitation(attrs, pepper);
  assert.equal(invitationTokenDigest(a.secret, pepper), a.tokenDigest);
  assert.notEqual(invitationTokenDigest(a.secret, pepper + '!'), a.tokenDigest);
  assert.throws(() => invitationTokenDigest('guess', pepper), /Invalid invitation secret/);
  assert.throws(() => invitationTokenDigest(a.secret, 'weak'), /pepper/);
});

test('recipient email digest is canonicalized and never equals the token hash', () => {
  const a = prepareInvitation(attrs, pepper);
  assert.equal(
    invitationEmailDigest(' adult@example.org ', pepper),
    a.recipientEmailDigest,
  );
  assert.notEqual(a.recipientEmailDigest, a.tokenDigest);
  assert.equal(recipientMatchesInvitation('adult@example.org', a.recipientEmailDigest, pepper), true);
  assert.equal(recipientMatchesInvitation('other@example.org', a.recipientEmailDigest, pepper), false);
});

test('reject malformed recipient emails and role escalation attempts', () => {
  assert.throws(() => normalizeInvitationEmail('first@example.org\nBcc: bad@example.org'), /Invalid recipient/);
  assert.throws(() => normalizeInvitationEmail('not-a-mailbox'), /Invalid recipient/);
  assert.throws(() => prepareInvitation({ ...attrs, intendedRole: 'owner' as never }, pepper), /Unsupported invitation role/);
});

test('require trusted inviter scope and bounded expiry', () => {
  assert.throws(() => prepareInvitation({ ...attrs, familyId: '' }, pepper), /Verified inviter/);
  assert.throws(() => prepareInvitation({ ...attrs, inviterAuthUserId: '' }, pepper), /Verified inviter/);
  assert.throws(() => prepareInvitation({ ...attrs, ttlHours: 0 }, pepper), /lifetime/);
  assert.throws(() => prepareInvitation({ ...attrs, ttlHours: 169 }, pepper), /lifetime/);
  assert.throws(() => prepareInvitation({ ...attrs, ttlHours: 1.5 }, pepper), /lifetime/);
});

test('constant-time comparison rejects malformed digests rather than comparing strings', () => {
  const a = prepareInvitation(attrs, pepper);
  assert.equal(constantTimeDigestMatch(a.tokenDigest, a.tokenDigest), true);
  assert.equal(constantTimeDigestMatch(a.tokenDigest, 'x'.repeat(64)), false);
  assert.equal(constantTimeDigestMatch(a.tokenDigest, '0'.repeat(64)), false);
});
