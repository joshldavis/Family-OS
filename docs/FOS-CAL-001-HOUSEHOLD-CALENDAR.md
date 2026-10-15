# FOS-CAL-001 — household-scoped calendar consistency

**Review-only branch:** `fix/fos-cal-001-household-calendar-consistency`
**Stacked dependency:** draft [PR #9](https://github.com/joshldavis/Family-OS/pull/9) and operating-mode PRs #7/#6. No production changes or database migration.

## Product changes

1. Calendar and Learning Support now call **the same date utility** (`src/calendar/date.ts`). Date-only assignment deadlines remain a local date; absolute timestamps ending with Z or timezone offsets convert to the browser's local calendar date. Naive datetime strings are local wall-clock dates. Invalid timestamps remain invalid instead of being silently normalized.
2. Calendar's month cells use local dates (not UTC `toISOString`), including year/month rollovers.
3. The Calendar's agenda/month items are filtered to records matching the current household. Legacy `Assignment` lacks a family ID: an assignment is visible only if its student ID references a student whose `familyId` matches the current signed-in user's family. Foreign events and orphan assignments do not appear.
4. Learning Support event cards deep link to `#/calendar?day=YYYY-MM-DD`. Calendar focuses the requested month/day; invalid dates are ignored. This fixes the misleading navigation where a card showed a local day but Calendar grouped the item under the UTC day.
5. Manual and AI-reviewed event creation use `state.currentUser.familyId` instead of the hardcoded demo ID `fam-1`. Event creation validates date/time. AI-extracted results are **not preselected**; a parent must explicitly verify/select them, and can edit extracted date/time. No arbitrary 9 AM default for missing extracted times.
6. The prior Calendar "Sync Google" **fabricated** a Google event and replaced existing event state, rather than integrating with Google Calendar. That simulated data write is removed; the UI labels the integration as unconfigured. Manual entries no longer claim to have been published to Google.
7. Date parse failures are counted on Calendar with a non-sensitive warning; existing records are never automatically removed.

## Tested

- Calendar local date, UTC and offset conversions, DST nonexistent times, rollover, invalid date/time.
- Family filtering of events and student-owned assignments. Invalid entries are not assigned arbitrary days.
- Static regressions check no hardcoded `fam-1` event writes or fake Google synchronization; Learning Support deep links and explicit AI review.
- Normal and mode-enabled builds. Separate `TZ=America/New_York` test jobs.

## Limits

- These are **client-side** defense-in-depth filters. They do not fix existing browser-global state, authentication, row-level security or Supabase ownership checks. FOS-SEC-001 remains required before sensitive child data can be persisted or read in production.
- This is NOT a working Google Calendar integration; no OAuth/sync/API call is added.
- Cross-device household timezone settings are not yet implemented: "local" is the current browser/device timezone.
- Invalid/out-of-household data is skipped in the view, never deleted. Existing form only creates a same-day event; extracted events can span midnight.
- No merge or production deploy. The Learning Lab stays on its last reviewed PR #9 until explicit promotion after QA.

## Manual QA (isolated lab after separate deployment)

- As a demo Parent, create a calendar event. Verify it appears under today's local date and is tied to the current family. Switch to Learning Support and follow its event card back to the correct day.
- Verify a UTC timestamp near midnight shows on the same day in Learning Support and Calendar.
- Test invalid date, old month/year transitions and spring DST gap.
- Verify another family's event, orphan assignment and unrelated student's assignment cannot appear in the current family view.
- Select an extracted event only after confirming its date and time. No event may be written by simply running extraction.
- Check Google sync labels are honest, and no synthetic event is created.
- Verify General Family dashboard, Calendar navigation and existing non-calendar modules remain unchanged.
