/**
 * Safe, pure intake adapter for school-email intelligence.
 *
 * This deliberately produces review candidates, never assignments/events or
 * side effects. The legacy emailRouter.ts remains untouched until an
 * authenticated, approval-gated action gateway is installed.
 */
import type { ClassifiedEmail } from '../types';

export type CaptureCandidateKind =
  | 'event' | 'assignment' | 'action' | 'behavior_observation' | 'announcement';

export type CaptureReviewStatus = 'ready_for_review' | 'needs_correction';

export interface StudentReference {
  id: string;
  name: string;
}

export interface CaptureCandidate {
  /** Deterministic across retries for a source in a given household. */
  idempotencyKey: string;
  familyId: string;
  source: {
    sourceSystem: 'school_email';
    externalRef: string;
    receivedAt: string | null;
  };
  kind: CaptureCandidateKind;
  title: string;
  studentId: string | null;
  studentMatch: 'exact' | 'ambiguous' | 'unresolved' | 'not_applicable';
  reviewStatus: CaptureReviewStatus;
  /** Classification confidence is advisory only; it never authorizes writes. */
  confidence: number | null;
  issues: string[];
  proposedFields: {
    date: string | null;
    time: string | null;
    subject: string | null;
    location: string | null;
    description: string | null;
  };
}

/** Returns a valid date or null, never an invented fallback. */
function verifiedISODate(date: string | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() + 1 === month &&
    check.getUTCDate() === day
  ) ? date : null;
}

function normalizedName(value: string): string {
  return value.toLocaleLowerCase('en-US').trim().replace(/\s+/g, ' ');
}

function resolveStudent(
  name: string | null,
  students: readonly StudentReference[],
): { id: string | null; match: CaptureCandidate['studentMatch'] } {
  if (!name?.trim()) return { id: null, match: 'unresolved' };
  const normalized = normalizedName(name);
  const matches = students.filter(student => normalizedName(student.name) === normalized);
  if (matches.length === 1) return { id: matches[0].id, match: 'exact' };
  if (matches.length > 1) return { id: null, match: 'ambiguous' };
  // Partial names are never sufficient to auto-map to the first child.
  return { id: null, match: 'unresolved' };
}

const KIND_MAP: Partial<Record<ClassifiedEmail['category'], CaptureCandidateKind>> = {
  calendar_event: 'event',
  assignment: 'assignment',
  action_required: 'action',
  behavior_update: 'behavior_observation',
  announcement: 'announcement',
};

function cleanText(value?: string | null): string | null {
  return value?.trim() || null;
}

/**
 * Convert a classified email to at most one review candidate.
 * Reprocessing one email yields the same idempotency key.
 * If the input email is already marked duplicate, no proposal is produced.
 *
 * Importantly: a classification may be incorrect even with confidence 1.
 * A future trusted server gateway must check authorization and approval.
 */
export function proposeSchoolEmailCandidate(
  email: ClassifiedEmail,
  familyId: string,
  students: readonly StudentReference[],
): CaptureCandidate | null {
  if (!familyId.trim()) throw new Error('familyId is required');
  if (!email.id?.trim()) throw new Error('source email id is required for idempotency');
  if (email.isDuplicate || email.category === 'irrelevant') return null;

  const kind = KIND_MAP[email.category];
  if (!kind) return null;

  const d = email.extractedData;
  const issues: string[] = [];
  const requiresStudent = kind === 'assignment' || kind === 'behavior_observation';
  const student = requiresStudent || email.childName
    ? resolveStudent(email.childName, students)
    : { id: null, match: 'not_applicable' as const };

  if (requiresStudent && student.match !== 'exact') {
    issues.push('Confirm which child this information concerns.');
  } else if (student.match === 'ambiguous' || (email.childName && student.match === 'unresolved')) {
    issues.push('Child reference needs review.');
  }

  const title =
    kind === 'event' ? cleanText(d.eventTitle) :
    kind === 'assignment' ? cleanText(d.assignmentTitle) :
    kind === 'action' ? cleanText(email.subject) ?? cleanText(d.actionDescription) :
    kind === 'behavior_observation' ? cleanText(d.details) :
    cleanText(email.subject) ?? cleanText(d.summary);

  if (!title) issues.push('Confirm a title or description.');

  const sourceDate =
    kind === 'event' ? d.eventDate :
    kind === 'assignment' ? d.dueDate :
    kind === 'action' ? d.deadline :
    undefined;
  const date = verifiedISODate(sourceDate);
  if (sourceDate && !date) issues.push('Check invalid or ambiguous date.');
  if ((kind === 'event' || kind === 'assignment') && !date) {
    issues.push('Date is missing; do not assume today or a default time.');
  }

  if (email.confidence < 0 || email.confidence > 1 || !Number.isFinite(email.confidence)) {
    issues.push('Classification confidence is invalid.');
  }

  // Never manufacture a 09:00 start or a 10:00 finish for an event.
  const rawTime = kind === 'event' ? cleanText(d.eventTime) : null;
  const time = rawTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : null;
  if (kind === 'event' && !time) {
    issues.push('Confirm a real event time; do not assume 09:00.');
  }

  return {
    familyId,
    idempotencyKey: JSON.stringify(['family_os', familyId, 'school_email', email.id, kind]),
    source: {
      sourceSystem: 'school_email',
      externalRef: email.id,
      receivedAt: verifiedISODate(email.date),
    },
    kind,
    title: title ?? 'Untitled school item',
    studentId: student.id,
    studentMatch: student.match,
    reviewStatus: issues.length ? 'needs_correction' : 'ready_for_review',
    confidence: Number.isFinite(email.confidence) && email.confidence >= 0 && email.confidence <= 1
      ? email.confidence : null,
    issues,
    proposedFields: {
      date,
      time,
      subject: kind === 'assignment' ? cleanText(d.subject) : null,
      location: kind === 'event' ? cleanText(d.eventLocation) : null,
      description:
        kind === 'action' ? cleanText(d.actionDescription) :
        kind === 'behavior_observation' ? cleanText(d.details) :
        kind === 'announcement' ? cleanText(d.summary) : null,
    },
  };
}
