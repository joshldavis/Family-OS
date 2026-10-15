import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDayForTimestamp, isValidDateKey, localDateISO,
  monthCellDate, parseLocalCalendarDatetime,
} from './date.ts';

test('UTC timestamps become household local dates, not UTC prefixes', () => {
  const timestamp = '2026-10-16T00:30:00.000Z';
  assert.equal(calendarDayForTimestamp(timestamp), localDateISO(new Date(timestamp)));
  if (process.env.TZ === 'America/New_York') {
    assert.equal(calendarDayForTimestamp(timestamp), '2026-10-15');
  }
});

test('naive calendar datetime is local wall-clock, and offset is converted', () => {
  const wall = '2026-10-15T20:30';
  assert.equal(calendarDayForTimestamp(wall), '2026-10-15');
  assert.equal(parseLocalCalendarDatetime(wall)?.getHours(), 20);
  assert.equal(
    calendarDayForTimestamp('2026-10-15T20:30:00-04:00'),
    localDateISO(new Date('2026-10-16T00:30:00Z')),
  );
});

test('invalid dates and times are review-required, not normalized', () => {
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2028-02-29'), true);
  for (const input of [
    '2026-02-29T10:00', '2026-10-15T25:00',
    '2026-10-15T10:65', '2026-10-15T10:00:65Z',
    '2026-10-15T10:00+15:00', '2026-10-15T10:00+14:30',
    '2026-10-15T10:00+04:99', 'not a date',
  ]) {
    assert.equal(calendarDayForTimestamp(input), null, input);
  }
});

test('DST spring-forward nonexistent local times are not treated as confirmed', () => {
  if (process.env.TZ === 'America/New_York') {
    assert.equal(calendarDayForTimestamp('2027-03-14T02:30'), null);
    assert.equal(calendarDayForTimestamp('2027-03-14T03:30'), '2027-03-14');
  }
});

test('month cells preserve local days at January boundaries', () => {
  assert.equal(monthCellDate(2027, 0, 1), '2027-01-01');
  assert.equal(monthCellDate(2026, 11, 31), '2026-12-31');
  assert.equal(localDateISO(new Date(2027, 0, 1)), '2027-01-01');
});
