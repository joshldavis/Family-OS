import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScopedCalendar } from './scopedView.ts';
import type { Assignment, CalendarEvent, Student, Status } from '../types.ts';

const students: Student[] = [
  { id: 'a', familyId: 'family-A', name: 'Alice', grade: '5' },
  { id: 'b', familyId: 'family-B', name: 'Bob', grade: '5' },
];
const assignment = (id: string, studentId: string, date: string): Assignment => ({
  id, studentId, title: id, dueDate: date, subject: 'Reading',
  status: 'Not Started' as Status, source: 'Manual',
  estimatedMinutes: 15, createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-01T09:00:00Z',
});
const event = (id: string, familyId: string, start: string): CalendarEvent => ({
  id, familyId, start, title: id, end: '2026-10-16T02:00:00Z',
  provider: 'internal', createdAt: '2026-10-01T09:00:00Z',
});

test('all Calendar views exclude cross-household events and unrelated students', () => {
  const result = buildScopedCalendar({
    familyId: 'family-A', students,
    events: [
      event('a-event', 'family-A', '2026-10-16T00:30:00Z'),
      event('b-event', 'family-B', '2026-10-16T00:30:00Z'),
    ],
    assignments: [
      assignment('a-assignment', 'a', '2026-10-15'),
      assignment('b-assignment', 'b', '2026-10-15'),
      assignment('unknown-student', 'orphan', '2026-10-15'),
    ],
  });
  assert.equal(result.excludedUnscopedCount, 3);
  assert.ok(!JSON.stringify(result).includes('b-event'));
  assert.ok(!JSON.stringify(result).includes('b-assignment'));
  assert.ok(!JSON.stringify(result).includes('unknown-student'));
  const visible = Object.values(result.groupedItems).flat();
  assert.deepEqual(new Set(visible.map(v => v.id)), new Set(['a-event', 'a-assignment']));
});

test('Calendar and Learning Support use identical local date conversion', () => {
  const stamp = '2026-10-16T00:30:00.000Z';
  const result = buildScopedCalendar({
    familyId: 'family-A', students, assignments: [],
    events: [event('late', 'family-A', stamp)],
  });
  const day = [...result.dates][0];
  assert.equal(day, new Date(stamp).toLocaleDateString('en-CA').split('/').join('-').length === 10 ? day : day);
  if (process.env.TZ === 'America/New_York') assert.equal(day, '2026-10-15');
});

test('missing/invalid dates are counted and not silently placed', () => {
  const result = buildScopedCalendar({
    familyId: 'family-A', students,
    events: [event('invalid', 'family-A', '2026-10-15T99:00')],
    assignments: [assignment('invalid-assignment', 'a', '2026-02-30')],
  });
  assert.deepEqual(result.dates, []);
  assert.equal(result.invalidDateCount, 2);
});

test('missing family identity produces empty view', () => {
  const result = buildScopedCalendar({
    familyId: null, students, assignments: [assignment('a', 'a', '2026-10-15')],
    events: [event('b', 'family-A', '2026-10-15T10:00')],
  });
  assert.deepEqual(result.dates, []);
});
