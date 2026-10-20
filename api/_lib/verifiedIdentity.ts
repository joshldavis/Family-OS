/**
 * Trusted server-side Supabase identity verification.
 *
 * This module NEVER grants household access: it proves who the bearer token
 * belongs to. Only separately trusted DB membership/child-scope checks can
 * authorize reading or changing family records.
 *
 * Do not use getSession(), user_metadata, or client-supplied roles as authority.
 * Do not log tokens or verified email addresses.
 */
export interface SupabaseAuthVerifier {
  getUser(token: string): Promise<{
    data: { user: {
      id: string;
      email?: string;
      email_confirmed_at?: string | null;
      is_anonymous?: boolean;
    } | null };
    error: { message: string } | null;
  }>;
}

export type VerifiedIdentityResult =
  | { ok: true; authUserId: string }
  | {
    ok: false;
    reason: 'missing_token' | 'invalid_token' | 'unverified_identity' | 'auth_unavailable';
  };

export function parseBearerToken(header: string | null | undefined): string | null {
  if (typeof header !== 'string' || header.length > 8192) return null;
  const match = /^Bearer ([A-Za-z0-9_+./=~-]{16,4096})$/.exec(header);
  return match?.[1] ?? null;
}

/** Decode only after getUser(token) has verified this same bearer with Auth. */
export function verifiedBearerSessionId(header: string | null | undefined): string | null {
  const token = parseBearerToken(header);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as
      Record<string, unknown>;
    return typeof payload.session_id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(payload.session_id) ? payload.session_id : null;
  } catch { return null; }
}

/**
 * Confirm a real, non-anonymous, email-verified Supabase Auth user.
 * An Auth identity alone must not be treated as household membership.
 */
export async function verifyBearerIdentity(
  authorization: string | null | undefined,
  auth: SupabaseAuthVerifier,
): Promise<VerifiedIdentityResult> {
  const token = parseBearerToken(authorization);
  if (!token) return { ok: false, reason: 'missing_token' };
  try {
    const { data, error } = await auth.getUser(token);
    if (error || !data.user?.id) {
      return { ok: false, reason: 'invalid_token' };
    }
    const user = data.user;
    if (
      user.is_anonymous ||
      !user.email ||
      !user.email_confirmed_at
    ) {
      return { ok: false, reason: 'unverified_identity' };
    }
    return { ok: true, authUserId: user.id };
  } catch {
    // The authorization service failed or is unreachable. Fail closed.
    return { ok: false, reason: 'auth_unavailable' };
  }
}
