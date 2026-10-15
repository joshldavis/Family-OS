/**
 * FOS-002 School Agent — server-only, READ-ONLY authorization boundary.
 *
 * This file is a TRUST CONTRACT, not a running endpoint and not an action
 * executor. It deliberately requires adapters which are NOT configured in
 * any deployment until FOS-SEC-001 confirms the real Family OS database,
 * household membership policies and authenticated Supabase project.
 *
 * Never trust client FamilyContext roles, user_metadata, family IDs, email
 * classifier confidence, or approval flags as proof of authorization.
 */
import { createHash } from 'node:crypto';
import { verifyBearerIdentity, type SupabaseAuthVerifier } from './verifiedIdentity.ts';

export interface TrustedSchoolProposal {
  /** Every field MUST be freshly loaded server-side, never request JSON. */
  id: string;
  familyId: string;
  sourceSystem: 'school_email';
  /** Hashed or opaque source reference. No raw email body or addresses. */
  sourceRefDigest: string;
  kind: 'assignment' | 'event' | 'action' | 'announcement' | 'behavior_observation';
  title: string;
  date: string | null;
  studentId: string | null;
  reviewStatus: 'ready_for_review' | 'needs_correction';
  /** Captured consent from the verified household's source connection. */
  consentCapturedAt: string | null;
  /** Must be checked freshly so consent revocation invalidates the preview. */
  consentStatus: 'active' | 'revoked' | 'pending';
  /** Explicit corrections/confirmations already trusted and stored server-side. */
  titleConfirmedByParent: boolean;
  studentConfirmedByParent: boolean;
  dateConfirmedByParent: boolean;
  /** Computed from current server-owned data, not browser state. */
  revision: string;
}

export interface TrustedHouseholdMembership {
  familyId: string;
  authUserId: string;
  role: 'parent' | 'child';
  status: 'active' | 'revoked' | 'pending';
}

export interface SchoolAgentReadAdapters {
  auth: SupabaseAuthVerifier;
  /** Trusted membership query, never front-end role or user_metadata. */
  getMembership(authUserId: string, familyId: string): Promise<TrustedHouseholdMembership | null>;
  /** A read scoped in SQL to family_id and proposal_id. */
  getProposal(familyId: string, proposalId: string): Promise<TrustedSchoolProposal | null>;
  /** Verify the confirmed student belongs to this same household in DB. */
  studentBelongsToFamily(familyId: string, studentId: string): Promise<boolean>;
}

/** Browser may only choose which server record to inspect, NOT the action payload. */
export interface SchoolAgentPreviewRequest {
  familyId: string;
  proposalId: string;
  expectedRevision: string;
}

export type SchoolAgentPreviewError =
  | 'invalid_request' | 'missing_token' | 'invalid_token' | 'unverified_identity'
  | 'auth_unavailable' | 'membership_denied' | 'data_unavailable'
  | 'source_not_found' | 'source_changed' | 'consent_required'
  | 'needs_parent_correction' | 'unsupported_action' | 'student_not_verified';

export type SchoolAgentPreviewResult =
  | { ok: false; reason: SchoolAgentPreviewError; executed: false }
  | {
      ok: true;
      status: 'review_only_not_authorized_for_execution';
      executed: false;
      /**
       * Deterministic CONTENT address only. Future persistence must enforce
       * database uniqueness and atomic execution; a hash alone is not a lock.
       */
      proposedIdempotencyKey: string;
      actorAuthUserId: string;
      familyId: string;
      proposalId: string;
      sourceRefDigest: string;
      sourceRevision: string;
      proposedAction: {
        kind: 'create_schoolwork_assignment';
        title: string;
        studentId: string;
        dueDate: string;
      };
    };

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function trustedProposalRevision(source: Omit<TrustedSchoolProposal, 'revision'>): string {
  return digest([
    'family-os-school-proposal-v1',
    source.id, source.familyId, source.sourceSystem, source.sourceRefDigest,
    source.kind, source.title, source.date, source.studentId,
    source.reviewStatus, source.consentCapturedAt, source.consentStatus,
    source.titleConfirmedByParent, source.studentConfirmedByParent,
    source.dateConfirmedByParent,
  ]);
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() + 1 === m &&
    check.getUTCDate() === d;
}

function validOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 &&
    value.length <= 128 && /^[A-Za-z0-9:_-]+$/.test(value);
}

const reject = (reason: SchoolAgentPreviewError): SchoolAgentPreviewResult =>
  ({ ok: false, reason, executed: false });

/**
 * Only returns a possible FUTURE assignment action.
 *
 * It does not approve, persist, send, execute, log, enqueue, email or mutate.
 * All adapters are read-only; no production adapter is installed.
 * Future execute must reauthorize INSIDE the database transaction.
 */
export async function previewTrustedSchoolAction(
  authorization: string | null,
  request: SchoolAgentPreviewRequest,
  adapters: SchoolAgentReadAdapters,
): Promise<SchoolAgentPreviewResult> {
  const identity = await verifyBearerIdentity(authorization, adapters.auth);
  if (!identity.ok) return reject(identity.reason);
  if (!request || !validOpaqueId(request.familyId) ||
      !validOpaqueId(request.proposalId) ||
      !/^[0-9a-f]{64}$/.test(request.expectedRevision ?? '')) {
    return reject('invalid_request');
  }

  let membership: TrustedHouseholdMembership | null;
  try {
    membership = await adapters.getMembership(identity.authUserId, request.familyId);
  } catch {
    return reject('data_unavailable');
  }
  if (!membership || membership.authUserId !== identity.authUserId ||
      membership.familyId !== request.familyId ||
      membership.role !== 'parent' || membership.status !== 'active') {
    return reject('membership_denied');
  }

  let proposal: TrustedSchoolProposal | null;
  try {
    proposal = await adapters.getProposal(request.familyId, request.proposalId);
  } catch {
    return reject('data_unavailable');
  }
  if (!proposal || proposal.id !== request.proposalId ||
      proposal.familyId !== request.familyId ||
      proposal.sourceSystem !== 'school_email') {
    // Do not reveal whether another family has a matching source.
    return reject('source_not_found');
  }
  if (proposal.revision !== request.expectedRevision ||
      proposal.revision !== trustedProposalRevision(proposal)) {
    return reject('source_changed');
  }
  // Opaque digest requirement prevents accidentally returning raw email IDs
  // or identifying metadata from a misconfigured source adapter.
  if (!/^(?:pasted-sha256-)?[0-9a-f]{64}$/.test(proposal.sourceRefDigest)) {
    return reject('source_not_found');
  }
  if (proposal.consentStatus !== 'active' || !proposal.consentCapturedAt ||
      !Number.isFinite(Date.parse(proposal.consentCapturedAt))) {
    return reject('consent_required');
  }
  // Phase 1: no calendar write, behavior evaluation, diagnosis, or AI action.
  if (proposal.kind !== 'assignment') return reject('unsupported_action');
  if (proposal.reviewStatus !== 'ready_for_review' ||
      !proposal.title.trim() || proposal.title.length > 200 || /[\r\n]/.test(proposal.title) || !validDate(proposal.date) ||
      !proposal.titleConfirmedByParent || !proposal.dateConfirmedByParent ||
      !proposal.studentConfirmedByParent || !validOpaqueId(proposal.studentId)) {
    return reject('needs_parent_correction');
  }

  let verifiedStudent: boolean;
  try {
    verifiedStudent = await adapters.studentBelongsToFamily(
      request.familyId, proposal.studentId,
    );
  } catch {
    return reject('data_unavailable');
  }
  if (!verifiedStudent) return reject('student_not_verified');

  // Stable across identical reprocessing, but NOT an enforced uniqueness key.
  const proposedIdempotencyKey = digest([
    'family-os-school-action-v1',
    proposal.familyId, proposal.sourceRefDigest, 'create_schoolwork_assignment',
  ]);

  return {
    ok: true, status: 'review_only_not_authorized_for_execution', executed: false,
    proposedIdempotencyKey, actorAuthUserId: identity.authUserId,
    familyId: proposal.familyId, proposalId: proposal.id,
    sourceRefDigest: proposal.sourceRefDigest, sourceRevision: proposal.revision,
    proposedAction: {
      kind: 'create_schoolwork_assignment',
      title: proposal.title,
      studentId: proposal.studentId,
      dueDate: proposal.date,
    },
  };
}
