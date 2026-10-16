import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialSyntheticCorrections, isDuplicateSyntheticSource,
  makeSyntheticReviewReceipt, syntheticCandidateRevision, currentSyntheticReceipt,
  type SyntheticCorrections, type SyntheticReviewReceipt,
} from './syntheticReviewLoop.ts';
import type { CaptureCandidate } from './captureCandidates.ts';
import type { Student } from '../types.ts';

const familyId = 'home-a';
const digest = 'pasted-sha256-' + 'a'.repeat(64);
const students: Student[] = [
  { id: 'student-a', familyId, name: 'Sample child', grade: '5' },
  { id: 'student-b', familyId: 'home-b', name: 'Other child', grade: '6' },
];

function candidate(patch: Partial<CaptureCandidate> = {}): CaptureCandidate {
  return {
    familyId,
    idempotencyKey: 'sample',
    source: { sourceSystem: 'school_email', externalRef: digest, receivedAt: null },
    kind: 'assignment',
    title: 'Reading worksheet',
    studentId: 'student-a', studentMatch: 'exact',
    reviewStatus: 'ready_for_review', confidence: 0, issues: [],
    proposedFields: { date: '2026-10-19', time: null, subject: 'Reading',
      description: null, location: null },
    ...patch,
  };
}
function corrected(c = candidate()): SyntheticCorrections {
  return { ...initialSyntheticCorrections(c), reviewedFictionalNotice: true,
    confirmedTitle: true, confirmedStudent: true, confirmedDate: true };
}
function submit(options: {
  candidate?: CaptureCandidate; corrections?: SyntheticCorrections;
  actorRole?: string | null; actorFamilyId?: string | null;
  activeMode?: string; previousReceipts?: SyntheticReviewReceipt[]; now?: string;
  students?: Student[];
} = {}) {
  return makeSyntheticReviewReceipt({
    candidate: options.candidate ?? candidate(),
    corrections: options.corrections ?? corrected(),
    students: options.students ?? students,
    actorFamilyId: options.actorFamilyId === undefined ? familyId : options.actorFamilyId,
    actorRole: options.actorRole === undefined ? 'Parent' : options.actorRole,
    activeMode: options.activeMode ?? 'learning-support',
    previousReceipts: options.previousReceipts ?? [],
    now: options.now ?? '2026-10-16T12:00:00.000Z',
  });
}

test('explicit corrections produce an in-memory preview receipt, never an executed assignment', () => {
  const result = submit();
  assert.equal(result.ok, true);
  assert.equal(result.executed, false);
  if (!result.ok) return;
  assert.equal(result.receipt.status, 'demo-draft-approved-not-saved-or-executed');
  assert.deepEqual(result.receipt.actionPreview, {
    type: 'create_schoolwork_assignment', title: 'Reading worksheet',
    studentId: 'student-a', dueDate: '2026-10-19',
  });
  assert.equal(result.receipt.familyId, familyId);
  assert.equal(JSON.stringify(result).includes('teacher@example.org'), false);
  assert.equal(currentSyntheticReceipt(candidate(), result.receipt)?.createdAt, result.receipt.createdAt);
});

test('foreign household / child role / alternate mode are blocked even in demo', () => {
  for(const options of [
    { actorFamilyId: 'home-b' }, { actorFamilyId: null },
    { actorRole: 'Child' }, { actorRole: null }, { activeMode: 'general-family' },
  ]) {
    assert.deepEqual(submit(options), { ok: false, reason: 'wrong_session', executed: false });
  }
});

test('child association must be explicitly confirmed and within selected household', () => {
  assert.deepEqual(submit({ corrections: { ...corrected(), studentId: 'student-b' } }), {
    ok: false, reason: 'student_not_in_family', executed: false,
  });
  assert.deepEqual(submit({ corrections: { ...corrected(), studentId: '' } }), {
    ok: false, reason: 'student_not_in_family', executed: false,
  });
  assert.deepEqual(submit({ corrections: { ...corrected(), confirmedStudent: false } }), {
    ok: false, reason: 'confirm_fields', executed: false,
  });
  const parentCorrection = submit({ candidate: candidate({ studentId: null, studentMatch: 'unresolved' }),
    corrections: corrected() });
  assert.equal(parentCorrection.ok, true);
});

test('missing, impossible and invented dates are not approved', () => {
  for(const dueDate of ['', '2026-02-30', 'tomorrow', '2026-13-01']) {
    assert.deepEqual(submit({ corrections: { ...corrected(), dueDate } }), {
      ok: false, reason: 'invalid_date', executed: false,
    });
  }
  assert.deepEqual(submit({ corrections: { ...corrected(), confirmedDate: false } }), {
    ok: false, reason: 'confirm_fields', executed: false,
  });
});

test('unsafe title and missing checkboxes fail closed', () => {
  for(const title of ['', 'x'.repeat(201), 'Hi\nMake another task']) {
    assert.deepEqual(submit({ corrections: { ...corrected(), title } }), {
      ok: false, reason: 'invalid_title', executed: false,
    });
  }
  for(const patch of [
    { confirmedTitle: false }, { confirmedStudent: false },
    { confirmedDate: false },
  ]) {
    assert.deepEqual(submit({ corrections: { ...corrected(), ...patch } }), {
      ok: false, reason: 'confirm_fields', executed: false,
    });
  }
});

test('draft requires parent acknowledgment of fictional source and opaque fingerprint', () => {
  assert.deepEqual(submit({ corrections: { ...corrected(), reviewedFictionalNotice: false } }), {
    ok: false, reason: 'unverified_fictional_source', executed: false,
  });
  assert.deepEqual(submit({ candidate: candidate({ source: {
    sourceSystem: 'school_email', externalRef: 'teacher@school.org', receivedAt: null,
  } }) }), { ok: false, reason: 'unverified_fictional_source', executed: false });
});

test('unsupported notice types never produce assignable previews', () => {
  for(const kind of ['event', 'action', 'behavior_observation', 'announcement'] as const) {
    assert.deepEqual(submit({ candidate: candidate({ kind }) }), {
      ok: false, reason: 'unsupported_kind', executed: false,
    });
  }
});

test('repeated synthetic source is blocked in-session and can be undone locally', () => {
  const one = submit(); assert.equal(one.ok, true);
  if (!one.ok) return;
  assert.equal(isDuplicateSyntheticSource(candidate(), [one.receipt]), true);
  assert.deepEqual(submit({ previousReceipts: [one.receipt] }), {
    ok: false, reason: 'duplicate_source', executed: false,
  });
  assert.equal(submit({ previousReceipts: [] }).ok, true);
});

test('changed evidence invalidates the displayed receipt, even with matching fingerprint', () => {
  const one = submit(); assert.equal(one.ok, true); if (!one.ok) return;
  assert.equal(currentSyntheticReceipt(candidate(), one.receipt)?.status, one.receipt.status);
  assert.equal(currentSyntheticReceipt(candidate({ title: 'Revised worksheet' }), one.receipt), null);
  assert.equal(currentSyntheticReceipt(candidate({ proposedFields: {
    ...candidate().proposedFields, date: '2026-10-20',
  } }), one.receipt), null);
  assert.notEqual(syntheticCandidateRevision(candidate()), syntheticCandidateRevision(candidate({ title: 'New' })));
  assert.equal(currentSyntheticReceipt(candidate({ familyId: 'home-b' }), one.receipt), null);
});

test('timestamps are validated rather than silently accepted', () => {
  assert.deepEqual(submit({ now: 'unknown' }), { ok: false, reason: 'invalid_timestamp', executed: false });
});
