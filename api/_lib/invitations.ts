/**
 * One-time household invitation primitives for a future trusted server flow.
 *
 * NO routes invoke these yet. This module does not enroll users or write to
 * Supabase. The future server must verify authenticated inviter/recipient,
 * check a stored membership capability and redeem transactionally in Postgres.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type InvitedAdultRole = 'parent';

export interface InvitationIssueParams {
  /** Verified inviter household from trusted membership read, NOT client input. */
  familyId: string;
  /** Authenticated inviter uid from Supabase getUser, NOT client input. */
  inviterAuthUserId: string;
  recipientEmail: string;
  intendedRole: InvitedAdultRole;
  ttlHours: number;
}

export interface PreparedInvitation {
  /** Secret shown to the inviter once; NEVER stored or logged. */
  secret: string;
  /** Store only these HMAC digests, not the original invitation or email. */
  tokenDigest: string;
  recipientEmailDigest: string;
  expiresAt: string;
  familyId: string;
  inviterAuthUserId: string;
  intendedRole: InvitedAdultRole;
}

export function normalizeInvitationEmail(email: string): string {
  const value = email.trim().toLowerCase();
  // Conservative baseline, not a full RFC email parser.
  if (
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    value.includes('\n') || value.includes('\r')
  ) {
    throw new Error('Invalid recipient email address.');
  }
  return value;
}

export function invitationTokenDigest(secret: string, pepper: string): string {
  if (pepper.length < 32) throw new Error('An invitation HMAC pepper of at least 32 characters is required.');
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error('Invalid invitation secret.');
  return createHmac('sha256', pepper).update('family-os/invitation/token/v1\0' + secret).digest('hex');
}

export function invitationEmailDigest(email: string, pepper: string): string {
  if (pepper.length < 32) throw new Error('An invitation HMAC pepper of at least 32 characters is required.');
  return createHmac('sha256', pepper)
    .update('family-os/invitation/recipient/v1\0' + normalizeInvitationEmail(email))
    .digest('hex');
}

export function constantTimeDigestMatch(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Validate an invitation request already authorized by the trusted server. */
export function prepareInvitation(
  params: InvitationIssueParams,
  pepper: string,
  now = new Date(),
): PreparedInvitation {
  if (!params.familyId.trim() || !params.inviterAuthUserId.trim()) {
    throw new Error('Verified inviter identity and household are required.');
  }
  if (params.intendedRole !== 'parent') {
    throw new Error('Unsupported invitation role.');
  }
  if (!Number.isInteger(params.ttlHours) || params.ttlHours < 1 || params.ttlHours > 168) {
    throw new Error('Invitation lifetime must be between one hour and seven days.');
  }
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid timestamp.');
  const email = normalizeInvitationEmail(params.recipientEmail);
  const secret = randomBytes(32).toString('base64url');
  return {
    secret,
    tokenDigest: invitationTokenDigest(secret, pepper),
    recipientEmailDigest: invitationEmailDigest(email, pepper),
    expiresAt: new Date(now.getTime() + params.ttlHours * 60 * 60 * 1000).toISOString(),
    familyId: params.familyId,
    inviterAuthUserId: params.inviterAuthUserId,
    intendedRole: params.intendedRole,
  };
}

/** Server must also verify the invitation isn't expired/revoked/redeemed. */
export function recipientMatchesInvitation(
  verifiedRecipientEmail: string,
  expectedDigest: string,
  pepper: string,
): boolean {
  try {
    return constantTimeDigestMatch(
      invitationEmailDigest(verifiedRecipientEmail, pepper),
      expectedDigest,
    );
  } catch {
    return false;
  }
}
