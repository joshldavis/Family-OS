import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningSupportSummary } from './summary.ts';
import type { Assignment, Student, CalendarEvent, Status } from '../types.ts';

const DONE = 'Done' as Status;
const NOT_STARTED = 'Not Started' as Status;

const students: Student[] = [
  { id: 'child-1', familyId: 'family-a', name: 'Student A', grade: '5' },
  { id: 'child-2', familyId: 'family-b', name: 'Student B', grade: '7' },
];

const assignment = (
  id: string, studentId: string, dueDate: string, status = NOT_STARTED,
): Assignment => ({
  id, studentId, dueDate, status, subject: 'Reading',
  title: 'Finish reading log', estimatedMinutes: 10, source: 'Manual',
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
});

const event = (id: string, familyId: string, start: string): CalendarEvent => ({
  id, familyId, title: 'School meeting', start,
  end: '2026-10-15T11:00', provider: 'internal',
  createdAt: '2026-10-01T10:00:00Z',
});

function run(assignments: Assignment[], events: CalendarEvent[] = []) {
  return buildLearningSupportSummary({
    familyId: 'family-a', today: '2026-10-14', students, assignments, events,
  });
}

test('overdue and soon assignments are prioritized, upcoming items are organized', () => {
  const s = run([
    assignment('late', 'child-1', '2026-10-12'),
    assignment('today', 'child-1', '2026-10-14'),
    assignment('soon', 'child-1', '2026-10-17'),
    assignment('later', 'child-1', '2026-10-23'),
    assignment('far', 'child-1', '2026-11-30'),
  ]);
  assert.deepEqual(s.attention.map(x => x.id), [
    'assignment:late', 'assignment:today', 'assignment:soon',
  ]);
  assert.deepEqual(s.organized.map(x => x.id), ['assignment:later']);
  assert.equal(s.attention[0].person, 'Student A');
  assert.ok(s.attention[0].detail.includes('Overdue'));
  assert.deepEqual(s.counts, { attention: 3, organized: 1, review: 0 });
});

test('missing dates require review instead of being silently replaced', () => {
  const s = run([assignment('missing-date', 'child-1', '')]);
  assert.equal(s.review.length, 1);
  assert.equal(s.review[0].dueDate, null);
  assert.match(s.review[0].detail, /Verify/);
  const bad = run([assignment('invalid', 'child-1', '2026-02-29')]);
  assert.equal(bad.review.length, 1);
});

test('completed work is not mislabeled overdue; recently completed work is organized', () => {
  const s = run([
    assignment('done', 'child-1', '2026-10-13', DONE),
    assignment('old-done', 'child-1', '2026-09-01', DONE),
  ]);
  assert.equal(s.attention.length, 0);
  assert.deepEqual(s.organized.map(x => x.id), ['assignment:done']);
});

test('student id/family match protects against unrelated family and orphan assignments', () => {
  const s = run([
    assignment('family-b', 'child-2', '2026-10-14'),
    assignment('orphan', 'unknown', '2026-10-14'),
    assignment('family-a', 'child-1', '2026-10-14'),
  ], [
    event('b-event', 'family-b', '2026-10-15T10:00'),
    event('a-event', 'family-a', '2026-10-15T10:00'),
  ]);
  assert.equal(s.excludedUnscopedAssignments, 2);
  assert.deepEqual(s.attention.map(x => x.id), ['assignment:family-a']);
  assert.deepEqual(s.organized.map(x => x.id), ['event:a-event']);
  assert.ok(!JSON.stringify(s).includes('family-b'));
  assert.ok(!JSON.stringify(s).includes('Student B'));
});

test('events cannot invent child association or time', () => {
  const s = run([], [
    event('good', 'family-a', '2026-10-16T09:00'),
    event('good-utc', 'family-a', '2026-10-16T11:00:00.000Z'),
    event('bad', 'family-a', 'not-a-real-date'),
    event('bad-clock', 'family-a', '2026-10-16T99:99'),
  ]);
  assert.equal(s.organized.length, 2);
  assert.equal(s.organized[0].person, null);
  assert.equal(s.organized[0].dueDate, '2026-10-16');
  assert.equal(s.review.length, 2);
  assert.ok(s.review.every(item => item.dueDate === null));
});

test('no family identity means no data is visible', () => {
  const s = buildLearningSupportSummary({
    familyId: null, today: '2026-10-14', students,
    assignments: [assignment('one', 'child-1', '2026-10-14')],
    events: [event('one', 'family-a', '2026-10-14T10:00')],
  });
  assert.equal(s.counts.attention + s.counts.organized + s.counts.review, 0);
});

test('calendar date calculations remain stable across date boundaries', () => {
  const s = buildLearningSupportSummary({
    familyId: 'family-a', today: '2026-12-31', students,
    assignments: [assignment('jan', 'child-1', '2027-01-02')],
    events: [],
  });
  assert.deepEqual(s.attention.map(x => x.id), ['assignment:jan']);
});

test('origin is labeled as user/import/AI entry, not verified email evidence', () => {
  const ai: Assignment = { ...assignment('ai', 'child-1', '2026-10-14'), source: 'AI' };
  const s = run([ai]);
  assert.match(s.attention[0].sourceLabel ?? '', /verify origin/);
});

test('empty and distant data yields an empty non-diagnostic summary', () => {
  const s = run([], []);
  assert.deepEqual(s.counts, { attention: 0, organized: 0, review: 0 });
  assert.deepEqual(s.attention, []);
});

test('malformed today fails rather than silently normalizing dates', () => {
  assert.throws(() => buildLearningSupportSummary({
    familyId: 'family-a', today: '2026-02-30', students,
    assignments: [], events: [],
  }), /valid local date/);
});
