import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningSupportSummary } from './summary.ts';
import {
  deriveDecisionCandidates, isCurrentDecision, recordDraftDecision, summarizeDraftReviews,
} from './decisionInbox.ts';
import type { Student, Assignment, CalendarEvent, Status } from '../types.ts';

const students: Student[] = [
  { id: 'kid-a', familyId: 'home-A', name: 'Student A', grade: '5' },
  { id: 'kid-b', familyId: 'home-B', name: 'Student B', grade: '6' },
];
const assignment = (
  id: string, studentId: string, dueDate: string, status = 'Not Started' as Status,
): Assignment => ({
  id, studentId, title: id, subject: 'Math', dueDate, status, source: 'Manual',
  estimatedMinutes: 20, createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});
const event = (id: string, familyId: string, start: string): CalendarEvent => ({
  id, familyId, title: id, start, end: '', provider: 'internal',
  createdAt: '2026-10-01T00:00:00Z',
});
const at = '2026-10-14T14:40:00.000Z';
const getCandidates = (assignments: Assignment[], events: CalendarEvent[] = [], familyId = 'home-A') =>
  deriveDecisionCandidates(familyId, buildLearningSupportSummary({
    familyId, assignments, events, students, today: '2026-10-14',
  }));
const submit = (
  candidate: ReturnType<typeof getCandidates>[number],
  overrides: Record<string, unknown> = {},
) => recordDraftDecision({
  candidate, disposition: 'approved-draft', actorFamilyId: 'home-A',
  actorRole: 'Parent', activeMode: 'learning-support',
  now: at,
  ...overrides,
});

test('deterministic review suggestions come from overdue/due soon and unresolved records only', () => {
  const list = getCandidates([
    assignment('late', 'kid-a', '2026-10-10'),
    assignment('soon', 'kid-a', '2026-10-16'),
    assignment('later', 'kid-a', '2026-11-21'),
    assignment('missing', 'kid-a', ''),
  ], [
    event('future-confirmed', 'home-A', '2026-10-15T10:00'),
    event('bad', 'home-A', 'invalid'),
  ]);
  assert.deepEqual(list.map(c => c.sourceId), [
    'assignment:late', 'assignment:soon',
    'event:bad', 'assignment:missing',
  ]);
  assert.equal(list[0].bucket, 'attention');
  assert.equal(list.find(c => c.sourceId === 'assignment:missing')?.needsConfirmedDate, true);
  assert.equal(list.find(c => c.sourceId === 'event:bad')?.mustFixSource, true);
  assert.equal(list[1].sourceHref, '/schoolwork');
  assert.equal(list[1].familyId, 'home-A');
});

test('cross-family and orphan schoolwork and calendar items never become suggestions', () => {
  const list = getCandidates([
    assignment('foreign', 'kid-b', '2026-10-14'),
    assignment('orphan', 'no-student', '2026-10-14'),
    assignment('owned', 'kid-a', '2026-10-14'),
  ], [
    event('foreign-event', 'home-B', 'invalid'),
    event('owned-event', 'home-A', 'invalid'),
  ]);
  assert.deepEqual(list.map(x => x.sourceId), [
    'assignment:owned', 'event:owned-event',
  ]);
  assert.ok(!JSON.stringify(list).includes('foreign'));
  assert.ok(!JSON.stringify(list).includes('kid-b'));
  assert.deepEqual(deriveDecisionCandidates(null, buildLearningSupportSummary({
    familyId: 'home-A', assignments: [assignment('owned', 'kid-a', '2026-10-14')],
    events: [], students, today: '2026-10-14',
  })), []);
});

test('only an active parent in the same family can record a draft review', () => {
  const c = getCandidates([assignment('soon', 'kid-a', '2026-10-15')])[0];
  for(const overrides of [
    { actorFamilyId: 'home-B' },
    { actorFamilyId: null },
    { actorRole: 'Child' },
    { actorRole: null },
    { activeMode: 'general-family' },
  ]) {
    assert.throws(() => submit(c, overrides), /current household parent/);
  }
  assert.equal(submit(c).disposition, 'approved-draft');
});

test('approving a missing-date assignment requires a valid parent-supplied date', () => {
  const c = getCandidates([assignment('unknown-deadline', 'kid-a', '')])[0];
  assert.throws(() => submit(c), /Confirm the missing assignment date/);
  assert.throws(() => submit(c, { confirmedDate: '2026-02-30' }), /Invalid confirmed date/);
  const accepted = submit(c, { confirmedDate: '2026-10-24', note: '  Ask school to verify.  ' });
  assert.equal(accepted.confirmedDate, '2026-10-24');
  assert.equal(accepted.note, 'Ask school to verify.');
  assert.equal(accepted.reviewedAt, at);
});

test('invalid calendar times must be corrected in the source, not draft-approved', () => {
  const c = getCandidates([], [event('unknown-time', 'home-A', 'not-a-date')])[0];
  assert.equal(c.mustFixSource, true);
  assert.throws(() => submit(c, { confirmedDate: '2026-10-20' }), /Source event must be corrected/);
  assert.equal(submit(c, { disposition: 'needs-correction' }).disposition, 'needs-correction');
});

test('source revision changes invalidate earlier draft approvals', () => {
  const first = getCandidates([assignment('math', 'kid-a', '2026-10-14')])[0];
  const decided = submit(first);
  assert.equal(isCurrentDecision(first, decided), true);
  const changed = getCandidates([assignment('math', 'kid-a', '2026-10-15')])[0];
  assert.equal(first.id, changed.id);
  assert.equal(isCurrentDecision(changed, decided), false);
  assert.deepEqual(summarizeDraftReviews([changed], { [first.id]: decided }), {
    open: 1, approvedDrafts: 0, needsCorrection: 0, dismissed: 0,
  });
});

test('draft counts reflect only current session matches; dismiss and correction are reversible', () => {
  const [a, b] = getCandidates([
    assignment('a', 'kid-a', '2026-10-14'),
    assignment('b', 'kid-a', '2026-10-15'),
  ]);
  const drafts = {
    [a.id]: submit(a, { disposition: 'dismissed' }),
    [b.id]: submit(b, { disposition: 'needs-correction' }),
  };
  assert.deepEqual(summarizeDraftReviews([a, b], drafts), {
    open: 0, approvedDrafts: 0, needsCorrection: 1, dismissed: 1,
  });
  assert.deepEqual(summarizeDraftReviews([a, b], {}), {
    open: 2, approvedDrafts: 0, needsCorrection: 0, dismissed: 0,
  });
});

test('parent notes are bounded and never required', () => {
  const c = getCandidates([assignment('a', 'kid-a', '2026-10-14')])[0];
  assert.equal(submit(c, { note: 'x'.repeat(700) }).note.length, 400);
  assert.equal(submit(c).note, '');
  assert.throws(() => submit(c, { now: 'invalid' }), /Invalid review timestamp/);
});
