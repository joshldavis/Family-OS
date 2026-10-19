/**
 * FOS-004 — trusted approval transaction ORCHESTRATION CONTRACT.
 *
 * No production HTTP route has been implemented. Invoking this code
 * requires explicit transaction adapters, and it never reads client role or
 * accepts a client-supplied title, child, deadline, or approval.
 *
 * The adapter MUST use a single SERIALIZABLE transaction, lock membership,
 * source, consent, proposal and receipt, enforce unique claims in Postgres,
 * and roll back ALL writes if any step throws. Reject a session revoked after
 * bearer getUser via a fresh DB session check in the trusted adapter.
 *
 * A reviewed Postgres connection and deployment authorization are blockers.
 */
import { createHash } from 'node:crypto';
import { verifyBearerIdentity, type SupabaseAuthVerifier } from './verifiedIdentity.ts';
import {
  trustedProposalRevision,
  type TrustedHouseholdMembership,
  type TrustedSchoolProposal,
} from './schoolAgentApprovalPreview.ts';

export interface TrustedLockedSource {
  familyId: string;
  sourceId: string;
  sourceRefDigest: string;
  consentStatus: 'active' | 'pending' | 'revoked';
  consentGrantedAt: string | null;
}

export interface TrustedLockedReview {
  id: string;
  familyId: string;
  proposalId: string;
  sourceId: string;
  sourceRevision: string;
  decision: 'approved' | 'rejected' | 'needs_correction' | 'withdrawn';
  reviewedByAuthUserId: string;
  confirmedTitle: string | null;
  confirmedStudentId: string | null;
  confirmedDueDate: string | null;
}

export interface SchoolAgentActionClaim {
  kind: 'create_schoolwork_assignment';
  familyId: string;
  sourceId: string;
  proposalId: string;
  approvalId: string;
  sourceRevision: string;
  idempotencyDigest: string;
}

export interface SchoolAgentExecutionTx {
  /**
   * Lock the auth session, membership, proposal, consent and receipt. An
   * implementation MUST preserve consistent locking order and reject revoked
   * sessions even when a previously issued JWT is still technically valid.
   */
  /**
   * Validate the EXACT bearer session (not any other session belonging to the
   * user). Server-only token handling; never log or store authorizationHeader.
   * The adapter may inspect a verified session_id and compare against a
   * trusted auth.sessions record or an equivalent provider revocation check.
   */
  activeSession(authUserId: string, authorizationHeader: string): Promise<boolean>;
  lockMembership(authUserId: string, familyId: string): Promise<TrustedHouseholdMembership | null>;
  lockProposal(familyId: string, proposalId: string): Promise<TrustedSchoolProposal | null>;
  lockSourceAndConsent(familyId: string, proposalId: string): Promise<TrustedLockedSource | null>;
  lockReview(familyId: string, receiptId: string): Promise<TrustedLockedReview | null>;
  studentBelongsToFamily(familyId: string, studentId: string): Promise<boolean>;
  /** Atomic INSERT ... ON CONFLICT backed by UNIQUE(family,source,kind). */
  claimUniqueAction(claim: SchoolAgentActionClaim): Promise<'claimed' | 'already_executed' | 'conflict'>;
  /** Must insert with explicit familyId and studentId, never infer ownership. */
  createAssignment(fields: {
    familyId: string; studentId: string; title: string; dueDate: string;
    sourceId: string; actorAuthUserId: string;
  }): Promise<{ id: string; familyId: string; studentId: string }>;
  /** Same DB transaction; immutable action receipt + finalized claim. */
  finalizeAction(fields: {
    familyId: string; proposalId: string; sourceId: string; approvalId: string;
    actorAuthUserId: string; sourceRevision: string; assignmentId: string;
  }): Promise<{ actionReceiptId: string }>;
}

export interface SchoolAgentApprovalAdapters {
  auth: SupabaseAuthVerifier;
  /**
   * Never return a success if the callback threw. Roll back all writes.
   * Retry serialization failures only by re-entering the entire callback.
   */
  runSerializable<T>(callback: (tx: SchoolAgentExecutionTx) => Promise<T>): Promise<T>;
}

export interface SchoolAgentExecuteRequest {
  familyId: string;
  proposalId: string;
  expectedRevision: string;
  approvalId: string;
}

export type SchoolAgentExecuteResult =
  | {
      ok: true; executed: true; assignmentId: string; actionReceiptId: string;
      familyId: string;
    }
  | {
      ok: true; executed: false; reason: 'already_executed'; familyId: string;
    }
  | {
      ok: false; executed: false; reason:
        'invalid_request' | 'invalid_identity' | 'inactive_session' | 'membership_denied' |
        'source_not_found' | 'stale_source' | 'consent_denied' |
        'unconfirmed_assignment' | 'student_not_verified' |
        'approval_denied' | 'duplicate_pending' | 'transaction_failed';
    };

const rejected = (reason: Extract<SchoolAgentExecuteResult, { ok: false }>['reason']):
  SchoolAgentExecuteResult => ({ ok: false, executed: false, reason });

function opaqueId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 &&
    value.length <= 128 && /^[A-Za-z0-9:_-]+$/.test(value);
}

function validDate(value: string | null): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

function actionDigest(familyId: string, sourceId: string): string {
  return createHash('sha256')
    .update(JSON.stringify(['fos-004-v1', familyId, sourceId, 'create_schoolwork_assignment']))
    .digest('hex');
}

function isParentMember(
  membership: TrustedHouseholdMembership | null,
  actorAuthUserId: string,
  familyId: string,
): boolean {
  return Boolean(membership && membership.authUserId === actorAuthUserId &&
    membership.familyId === familyId && membership.role === 'parent' &&
    membership.status === 'active');
}

/**
 * Contract runner for vetted database adapters; no production route or
 * frontend button invokes this.
 *
 * Parent confirms server-stored immutable approval; executing parent MUST be
 * the same authenticated reviewer in v1. Never trust a browser "Approve" flag.
 */
export async function executeReviewedAssignment(
  authorization: string | null,
  request: SchoolAgentExecuteRequest,
  adapters: SchoolAgentApprovalAdapters,
): Promise<SchoolAgentExecuteResult> {
  const identity = await verifyBearerIdentity(authorization, adapters.auth);
  if (!identity.ok) return rejected('invalid_identity');

  if (!request || !opaqueId(request.familyId) || !opaqueId(request.proposalId) ||
      !opaqueId(request.approvalId) ||
      !/^[0-9a-f]{64}$/.test(request.expectedRevision ?? '')) {
    return rejected('invalid_request');
  }

  try {
    return await adapters.runSerializable(async tx => {
      const actorAuthUserId = identity.authUserId;
      if (!await tx.activeSession(actorAuthUserId, authorization ?? '')) {
        return rejected('inactive_session');
      }
      const membership = await tx.lockMembership(actorAuthUserId, request.familyId);
      if (!isParentMember(membership, actorAuthUserId, request.familyId)) {
        return rejected('membership_denied');
      }
      const proposal = await tx.lockProposal(request.familyId, request.proposalId);
      if (!proposal || proposal.familyId !== request.familyId ||
          proposal.id !== request.proposalId ||
          proposal.sourceSystem !== 'school_email') return rejected('source_not_found');

      const source = await tx.lockSourceAndConsent(request.familyId, request.proposalId);
      if (!source || source.familyId !== request.familyId ||
          !opaqueId(source.sourceId) ||
          !/^(?:pasted-sha256-)?[a-f0-9]{64}$/.test(source.sourceRefDigest) ||
          source.sourceRefDigest !== proposal.sourceRefDigest) {
        return rejected('source_not_found');
      }

      if (proposal.revision !== request.expectedRevision ||
          proposal.revision !== trustedProposalRevision(proposal)) {
        return rejected('stale_source');
      }
      if (source.consentStatus !== 'active' ||
          proposal.consentStatus !== 'active' ||
          !source.consentGrantedAt ||
          !Number.isFinite(Date.parse(source.consentGrantedAt)) ||
          !proposal.consentCapturedAt) {
        return rejected('consent_denied');
      }

      if (proposal.kind !== 'assignment' || proposal.reviewStatus !== 'ready_for_review' ||
          !proposal.title.trim() || proposal.title.length > 200 ||
          /[\r\n]/.test(proposal.title) ||
          !validDate(proposal.date) || !opaqueId(proposal.studentId) ||
          !proposal.titleConfirmedByParent ||
          !proposal.studentConfirmedByParent || !proposal.dateConfirmedByParent) {
        return rejected('unconfirmed_assignment');
      }

      if (!await tx.studentBelongsToFamily(request.familyId, proposal.studentId)) {
        return rejected('student_not_verified');
      }

      const review = await tx.lockReview(request.familyId, request.approvalId);
      if (!review || review.id !== request.approvalId ||
          review.familyId !== request.familyId ||
          review.proposalId !== request.proposalId ||
          review.sourceId !== source.sourceId ||
          review.sourceRevision !== proposal.revision ||
          review.decision !== 'approved' ||
          review.reviewedByAuthUserId !== actorAuthUserId ||
          review.confirmedTitle !== proposal.title ||
          review.confirmedStudentId !== proposal.studentId ||
          review.confirmedDueDate !== proposal.date) return rejected('approval_denied');

      const claimed = await tx.claimUniqueAction({
        kind: 'create_schoolwork_assignment',
        familyId: request.familyId, sourceId: source.sourceId,
        proposalId: proposal.id, approvalId: review.id,
        sourceRevision: proposal.revision,
        idempotencyDigest: actionDigest(request.familyId, source.sourceId),
      });
      if (claimed === 'already_executed') return {
        ok: true, executed: false, reason: 'already_executed', familyId: request.familyId,
      };
      if (claimed !== 'claimed') return rejected('duplicate_pending');

      // These are the ONLY domain write intents in this contract.
      const assignment = await tx.createAssignment({
        familyId: request.familyId, studentId: proposal.studentId,
        title: proposal.title, dueDate: proposal.date,
        sourceId: source.sourceId, actorAuthUserId,
      });
      if (!assignment.id || assignment.familyId !== request.familyId ||
          assignment.studentId !== proposal.studentId) {
        throw new Error('Assignment persisted outside trusted scope');
      }

      const receipt = await tx.finalizeAction({
        familyId: request.familyId, proposalId: proposal.id,
        sourceId: source.sourceId, approvalId: review.id,
        actorAuthUserId, sourceRevision: proposal.revision,
        assignmentId: assignment.id,
      });
      if (!receipt.actionReceiptId) throw new Error('Execution receipt missing');
      return {
        ok: true, executed: true,
        familyId: request.familyId, assignmentId: assignment.id,
        actionReceiptId: receipt.actionReceiptId,
      };
    });
  } catch {
    // Transaction failures, including conflicts / RLS / rollback, fail closed;
    // never log child identities, email source references or provider keys.
    return rejected('transaction_failed');
  }
}
