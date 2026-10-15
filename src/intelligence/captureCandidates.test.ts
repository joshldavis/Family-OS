import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeSchoolEmailCandidate } from './captureCandidates.ts';
import { fingerprintPastedSchoolEmail } from './sourceFingerprint.ts';
import type { ClassifiedEmail } from '../types';

const students = [
  { id: 'student-a', name: 'Aiden' },
  { id: 'student-b', name: 'Aria' },
];

function email(
  category: ClassifiedEmail['category'],
  data: ClassifiedEmail['extractedData'] = {},
  overrides: Partial<ClassifiedEmail> = {},
): ClassifiedEmail {
  return {
    id: 'msg-123',
    subject: 'School update',
    from: 'teacher@example.org',
    date: '2026-10-13',
    rawText: 'Hello family',
    category,
    confidence: 0.85,
    childName: null,
    isDuplicate: false,
    extractedData: data,
    ...overrides,
  };
}

test('school assignment with verified child and date produces a proposal, not a task', () => {
  const c = proposeSchoolEmailCandidate(
    email('assignment', { assignmentTitle: 'Reading practice', dueDate: '2026-10-15', subject: 'ELA' },
      { childName: 'Aiden' }),
    'family-a',
    students,
  );
  assert.ok(c);
  assert.equal(c.kind, 'assignment');
  assert.equal(c.studentId, 'student-a');
  assert.equal(c.proposedFields.date, '2026-10-15');
  assert.equal(c.proposedFields.subject, 'ELA');
  assert.equal(c.reviewStatus, 'ready_for_review');
  assert.equal(c.source.externalRef, 'msg-123');
  assert.ok(!('status' in c) && !('dispatch' in c));
});

test('missing child and date remain unresolved instead of becoming first child and today', () => {
  const c = proposeSchoolEmailCandidate(email('assignment', { assignmentTitle: 'Worksheet' }), 'family-a', students);
  assert.ok(c);
  assert.equal(c.studentId, null);
  assert.equal(c.proposedFields.date, null);
  assert.equal(c.reviewStatus, 'needs_correction');
  assert.equal(c.issues.length, 2);
});

test('partial or unknown child name cannot automatically resolve to the first child', () => {
  const c = proposeSchoolEmailCandidate(
    email('assignment', { assignmentTitle: 'Worksheet', dueDate: '2026-10-15' }, { childName: 'Aid' }),
    'family-a',
    students,
  );
  assert.ok(c);
  assert.equal(c.studentMatch, 'unresolved');
  assert.equal(c.studentId, null);
  assert.equal(c.reviewStatus, 'needs_correction');
});

test('duplicate exact names are ambiguous', () => {
  const c = proposeSchoolEmailCandidate(
    email('assignment', { assignmentTitle: 'Worksheet', dueDate: '2026-10-15' }, { childName: ' AIDEN ' }),
    'family-a',
    [{ id: 'one', name: 'Aiden' }, { id: 'two', name: 'aiden' }],
  );
  assert.ok(c);
  assert.equal(c.studentMatch, 'ambiguous');
  assert.equal(c.studentId, null);
});

test('date validation rejects non-existent dates and never makes up a time', () => {
  const c = proposeSchoolEmailCandidate(
    email('calendar_event', { eventTitle: 'Trip', eventDate: '2026-02-29' }),
    'family-a',
    students,
  );
  assert.ok(c);
  assert.equal(c.proposedFields.date, null);
  assert.equal(c.proposedFields.time, null);
  assert.equal(c.reviewStatus, 'needs_correction');
});

test('idempotency keys are stable for the same source but isolated per family', () => {
  const e = email('calendar_event', { eventTitle: 'Trip', eventDate: '2026-10-16' });
  const first = proposeSchoolEmailCandidate(e, 'family-a', students);
  const again = proposeSchoolEmailCandidate(e, 'family-a', students);
  const other = proposeSchoolEmailCandidate(e, 'family-b', students);
  assert.ok(first && again && other);
  assert.equal(first.idempotencyKey, again.idempotencyKey);
  assert.notEqual(first.idempotencyKey, other.idempotencyKey);
});

test('source-marked duplicate and irrelevant inputs produce no proposal', () => {
  assert.equal(
    proposeSchoolEmailCandidate(email('assignment', {}, { isDuplicate: true }), 'family-a', students),
    null,
  );
  assert.equal(proposeSchoolEmailCandidate(email('irrelevant'), 'family-a', students), null);
});

test('classification confidence is not authorization and invalid confidence demands review', () => {
  const c = proposeSchoolEmailCandidate(
    email('action_required', { actionDescription: 'Sign the form' }, { confidence: 9 }),
    'family-a',
    students,
  );
  assert.ok(c);
  assert.equal(c.confidence, null);
  assert.equal(c.reviewStatus, 'needs_correction');
  assert.equal(c.proposedFields.date, null);
});

test('behavior observation is separated from a task and requires child identity', () => {
  const c = proposeSchoolEmailCandidate(
    email('behavior_update', { details: 'Transition was difficult' }),
    'family-a',
    students,
  );
  assert.ok(c);
  assert.equal(c.kind, 'behavior_observation');
  assert.equal(c.studentId, null);
  assert.equal(c.reviewStatus, 'needs_correction');
});

test('missing family and missing email id are rejected', () => {
  assert.throws(() => proposeSchoolEmailCandidate(email('announcement'), '', students), /familyId/);
  assert.throws(() => proposeSchoolEmailCandidate(
    email('announcement', {}, { id: '' }),
    'family-a',
    students,
  ), /email id/);
});

test('pasted-message fingerprint is stable, omits raw text, and varies by source', async () => {
  const first = await fingerprintPastedSchoolEmail({
    from: 'Teacher@School.edu ',
    subject: ' Field Trip ',
    body: 'Permission slip due Friday',
  });
  const same = await fingerprintPastedSchoolEmail({
    from: 'teacher@school.edu',
    subject: 'Field Trip',
    body: 'Permission slip due Friday',
  });
  const other = await fingerprintPastedSchoolEmail({
    from: 'teacher@school.edu',
    subject: 'Field Trip',
    body: 'Permission slip due Saturday',
  });
  assert.equal(first, same);
  assert.notEqual(first, other);
  assert.match(first, /^pasted-sha256-[0-9a-f]{64}$/);
  assert.ok(!first.includes('Permission slip'));
});

test('event times are never fabricated; missing or invalid clocks need correction', () => {
  for (const eventTime of [undefined, '', '9 AM', '25:90']) {
    const candidate = proposeSchoolEmailCandidate(
      email('calendar_event', {
        eventTitle: 'Field day', eventDate: '2026-10-22', eventTime,
      }),
      'family-a', students,
    );
    assert.ok(candidate);
    assert.equal(candidate.reviewStatus, 'needs_correction');
    assert.equal(candidate.proposedFields.time, null);
    assert.match(candidate.issues.join(' '), /real event time/);
  }
  const valid = proposeSchoolEmailCandidate(
    email('calendar_event', {
      eventTitle: 'Field day', eventDate: '2026-10-22', eventTime: '14:30',
    }), 'family-a', students,
  );
  assert.ok(valid);
  assert.equal(valid.proposedFields.time, '14:30');
  assert.equal(valid.reviewStatus, 'ready_for_review');
});
