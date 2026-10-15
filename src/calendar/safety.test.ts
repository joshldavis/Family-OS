import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const calendar = readFileSync(new URL('../pages/Calendar.tsx', import.meta.url), 'utf8');
const learning = readFileSync(new URL('../learning-support/summary.ts', import.meta.url), 'utf8');

test('Calendar does not write fake demo household IDs into new events', () => {
  assert.doesNotMatch(calendar, /familyId:\s*['"]fam-1['"]/);
  assert.match(calendar, /const familyId = state\.currentUser\?\.familyId/);
  assert.match(calendar, /if \(!familyId\).*create events/);
});

test('Calendar lists and Learning Support derive from family-scoped local-date sources', () => {
  assert.match(calendar, /buildScopedCalendar\(/);
  assert.match(learning, /calendarDayForTimestamp\(event\.start\)/);
  assert.match(calendar, /new URLSearchParams\(location\.search\)\.get\('day'\)/);
  assert.match(learning, /'\/calendar\?day=' \+ date/);
});

test('Google calendar sync is not simulated through a misleading HYDRATE', () => {
  assert.doesNotMatch(calendar, /Work Project Sync \(Google\)/);
  assert.doesNotMatch(calendar, /setSyncComplete/);
  assert.doesNotMatch(calendar, /provider: syncToGoogle \? 'google'/);
});

test('AI-extracted events require explicit selection and verified date/time', () => {
  assert.match(calendar, /setChatResults\(parsed\.map\(e => \(\{ \.\.\.e, selected: false \}\)\)\)/);
  assert.match(calendar, /parseLocalCalendarDatetime\(\x60\$\{r\.date\}T\$\{r\.time\}\x60\)/);
});
