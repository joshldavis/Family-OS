import type { CaptureCandidate } from './captureCandidates.ts';
import type { Student } from '../types.ts';
import { isValidDateKey } from '../calendar/date.ts';

/**
 * FOS-003 is a SYNTHETIC, IN-MEMORY practice flow.
 *
 * Never confuse local role/student selectors with trusted Supabase membership;
 * no output from this module is a server authorization grant or executable task.
 */
export interface SyntheticCorrections {
  title: string;
  studentId: string;
  dueDate: string;
  confirmedTitle: boolean;
  confirmedStudent: boolean;
  confirmedDate: boolean;
  reviewedFictionalNotice: boolean;
}

export interface SyntheticReviewReceipt {
  status: 'demo-draft-approved-not-saved-or-executed';
  sourceFingerprint: string;
  sourceRevision: string;
  familyId: string;
  kind: 'assignment';
  actionPreview: {
    type: 'create_schoolwork_assignment';
    title: string;
    studentId: string;
    dueDate: string;
  };
  createdAt: string;
}

export type SyntheticReviewResult =
  | { ok: true; receipt: SyntheticReviewReceipt; executed: false }
  | { ok: false; reason: 'wrong_session' | 'unsupported_kind' | 'unverified_fictional_source' |
      'invalid_title' | 'student_not_in_family' | 'invalid_date' | 'confirm_fields' |
      'duplicate_source' | 'invalid_timestamp'; executed: false };

export function syntheticCandidateRevision(candidate: CaptureCandidate): string {
  return JSON.stringify([
    candidate.familyId, candidate.source.sourceSystem, candidate.source.externalRef,
    candidate.kind, candidate.title, candidate.studentId, candidate.studentMatch,
    candidate.reviewStatus, candidate.proposedFields.date, candidate.proposedFields.time,
    candidate.proposedFields.subject, candidate.proposedFields.description,
  ]);
}

export function initialSyntheticCorrections(candidate: CaptureCandidate): SyntheticCorrections {
  return {
    title: candidate.title,
    studentId: candidate.studentId ?? '',
    dueDate: candidate.proposedFields.date ?? '',
    confirmedTitle: false,
    confirmedStudent: false,
    confirmedDate: false,
    reviewedFictionalNotice: false,
  };
}

export function isDuplicateSyntheticSource(
  candidate: CaptureCandidate,
  receipts: readonly SyntheticReviewReceipt[],
): boolean {
  return receipts.some(receipt =>
    receipt.familyId === candidate.familyId &&
    receipt.sourceFingerprint === candidate.source.externalRef &&
    receipt.kind === 'assignment'
  );
}

export function makeSyntheticReviewReceipt(args: {
  candidate: CaptureCandidate;
  corrections: SyntheticCorrections;
  students: readonly Student[];
  actorFamilyId: string | null;
  actorRole: string | null;
  activeMode: string;
  previousReceipts: readonly SyntheticReviewReceipt[];
  now: string;
}): SyntheticReviewResult {
  const { candidate, corrections } = args;
  if (!args.actorFamilyId || candidate.familyId !== args.actorFamilyId ||
      args.actorRole !== 'Parent' || args.activeMode !== 'learning-support') {
    return { ok: false, reason: 'wrong_session', executed: false };
  }

  // Real calendar and communication execution are intentionally unsupported.
  if (candidate.kind !== 'assignment') {
    return { ok: false, reason: 'unsupported_kind', executed: false };
  }
  if (!/^pasted-sha256-[0-9a-f]{64}$/.test(candidate.source.externalRef) ||
      !corrections.reviewedFictionalNotice) {
    return { ok: false, reason: 'unverified_fictional_source', executed: false };
  }
  const title = corrections.title.trim();
  if (!title || title.length > 200 || /[\r\n]/.test(title)) {
    return { ok: false, reason: 'invalid_title', executed: false };
  }
  if (!corrections.studentId ||
      !args.students.some(student =>
        student.id === corrections.studentId &&
        student.familyId === args.actorFamilyId)) {
    return { ok: false, reason: 'student_not_in_family', executed: false };
  }
  if (!isValidDateKey(corrections.dueDate)) {
    return { ok: false, reason: 'invalid_date', executed: false };
  }
  if (!corrections.confirmedTitle || !corrections.confirmedStudent ||
      !corrections.confirmedDate) {
    return { ok: false, reason: 'confirm_fields', executed: false };
  }
  if (isDuplicateSyntheticSource(candidate, args.previousReceipts)) {
    return { ok: false, reason: 'duplicate_source', executed: false };
  }
  if (!Number.isFinite(Date.parse(args.now))) {
    return { ok: false, reason: 'invalid_timestamp', executed: false };
  }

  return {
    ok: true,
    executed: false,
    receipt: {
      status: 'demo-draft-approved-not-saved-or-executed',
      sourceFingerprint: candidate.source.externalRef,
      sourceRevision: syntheticCandidateRevision(candidate),
      familyId: candidate.familyId,
      kind: 'assignment',
      actionPreview: {
        type: 'create_schoolwork_assignment',
        title, studentId: corrections.studentId, dueDate: corrections.dueDate,
      },
      createdAt: args.now,
    },
  };
}

export function currentSyntheticReceipt(
  candidate: CaptureCandidate,
  receipt: SyntheticReviewReceipt | null | undefined,
): SyntheticReviewReceipt | null {
  if (!receipt || candidate.familyId !== receipt.familyId ||
      candidate.kind !== receipt.kind ||
      candidate.source.externalRef !== receipt.sourceFingerprint ||
      syntheticCandidateRevision(candidate) !== receipt.sourceRevision) return null;
  return receipt;
}
