import type { LearningSupportCard, LearningSupportSummary } from './summary.ts';
import { isValidDateKey } from '../calendar/date.ts';

/**
 * A LOCAL review prototype. No persistence, tasks, provider calls or approval
 * execution are permitted here. Source rows are already household-filtered by
 * buildLearningSupportSummary. Real approval needs verified server membership.
 */
export type ReviewDisposition = 'approved-draft' | 'needs-correction' | 'dismissed';

export interface DecisionCandidate {
  id: string;
  familyId: string;
  sourceRevision: string;
  sourceId: string;
  sourceHref: string;
  kind: 'assignment' | 'event';
  title: string;
  person: string | null;
  recordedDate: string | null;
  provenance: string;
  bucket: 'attention' | 'review';
  proposedAction: string;
  needsConfirmedDate: boolean;
  mustFixSource: boolean;
  reason: string;
}

export interface DraftReviewDecision {
  candidateId: string;
  familyId: string;
  sourceRevision: string;
  disposition: ReviewDisposition;
  // A date here is parent-confirmed for the draft ONLY, not updated in the app.
  confirmedDate: string | null;
  note: string;
  reviewedAt: string;
}

function revision(card: LearningSupportCard): string {
  // The complete visible evidence is the token; if the source changes, any
  // previous local approval is stale and cannot be reapplied or displayed.
  return JSON.stringify([
    card.id, card.bucket, card.title, card.detail, card.person,
    card.dueDate, card.sourceLabel, card.href,
  ]);
}

export function deriveDecisionCandidates(
  familyId: string | null,
  summary: LearningSupportSummary,
): DecisionCandidate[] {
  if (!familyId) return [];
  const sourceCards = [...summary.attention, ...summary.review];
  const results: DecisionCandidate[] = [];
  for (const card of sourceCards) {
    if (card.kind !== 'assignment' && card.kind !== 'event') continue;
    const needsConfirmedDate = card.kind === 'assignment' && card.dueDate === null;
    const mustFixSource = card.kind === 'event' && card.dueDate === null;
    const proposedAction = mustFixSource
      ? 'Verify the calendar event date and time in its source record'
      : needsConfirmedDate
        ? 'Confirm the assignment deadline before planning follow-up'
        : 'Review whether this assignment needs a family follow-up';

    results.push({
      id: 'decision:' + card.id + ':' + card.bucket,
      familyId,
      sourceRevision: revision(card),
      sourceId: card.id,
      sourceHref: card.href,
      kind: card.kind,
      title: card.title,
      person: card.person,
      recordedDate: card.dueDate,
      provenance: card.sourceLabel ?? 'Source origin not recorded',
      bucket: card.bucket === 'attention' ? 'attention' : 'review',
      proposedAction,
      needsConfirmedDate,
      mustFixSource,
      reason: card.detail,
    });
  }
  // Preserve deterministic, bucket-first urgency ordering from the selector.
  return results.sort((a, b) =>
    (a.bucket === b.bucket ? 0 : a.bucket === 'attention' ? -1 : 1) ||
    (a.recordedDate ?? '9999-12-31').localeCompare(b.recordedDate ?? '9999-12-31') ||
    a.title.localeCompare(b.title),
  );
}

export function isCurrentDecision(
  candidate: DecisionCandidate,
  decision: DraftReviewDecision | undefined,
): boolean {
  return Boolean(
    decision &&
    candidate.familyId === decision.familyId &&
    candidate.sourceRevision === decision.sourceRevision &&
    candidate.id === decision.candidateId,
  );
}

export type RecordDraftDecisionRequest = {
  candidate: DecisionCandidate;
  disposition: ReviewDisposition;
  confirmedDate?: string | null;
  note?: string;
  actorFamilyId: string | null;
  actorRole: string | null;
  activeMode: string;
  now: string;
};

export function recordDraftDecision(req: RecordDraftDecisionRequest): DraftReviewDecision {
  const { candidate, disposition } = req;
  if (!req.actorFamilyId || req.actorFamilyId !== candidate.familyId ||
      req.actorRole !== 'Parent' || req.activeMode !== 'learning-support') {
    throw new Error('Only the current household parent can review this proposal');
  }
  if (!['approved-draft', 'needs-correction', 'dismissed'].includes(disposition)) {
    throw new Error('Unknown review disposition');
  }
  if (!Number.isFinite(Date.parse(req.now))) throw new Error('Invalid review timestamp');
  const confirmedDate = req.confirmedDate?.trim() || null;
  if (confirmedDate && !isValidDateKey(confirmedDate)) throw new Error('Invalid confirmed date');
  if (disposition === 'approved-draft' && candidate.mustFixSource) {
    throw new Error('Source event must be corrected before draft approval');
  }
  if (disposition === 'approved-draft' && candidate.needsConfirmedDate && !confirmedDate) {
    throw new Error('Confirm the missing assignment date before approving a draft');
  }
  if (disposition === 'approved-draft' && !candidate.person) {
    throw new Error('A verified student association is required');
  }
  // Free-text notes are private session-only suggestions, never written or
  // attached to an LLM request. Trim conservatively.
  const note = (req.note ?? '').trim().slice(0, 400);
  return {
    candidateId: candidate.id, familyId: candidate.familyId,
    sourceRevision: candidate.sourceRevision,
    disposition,
    confirmedDate: candidate.needsConfirmedDate ? confirmedDate : candidate.recordedDate,
    note, reviewedAt: req.now,
  };
}

export function summarizeDraftReviews(
  candidates: readonly DecisionCandidate[],
  drafts: Readonly<Record<string, DraftReviewDecision>>,
) {
  let open = 0;
  let approvedDrafts = 0;
  let needsCorrection = 0;
  let dismissed = 0;
  for (const candidate of candidates) {
    const decision = drafts[candidate.id];
    if (!isCurrentDecision(candidate, decision)) { open++; continue; }
    if (decision.disposition === 'approved-draft') approvedDrafts++;
    if (decision.disposition === 'needs-correction') needsCorrection++;
    if (decision.disposition === 'dismissed') dismissed++;
  }
  return { open, approvedDrafts, needsCorrection, dismissed };
}
