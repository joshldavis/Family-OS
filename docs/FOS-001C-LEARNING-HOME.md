# FOS-001C — Learning Support Home

**State:** staged implementation in a draft PR, stacked on FOS-001B (PR #7), which is itself stacked on FOS-001A (PR #6). **Not merged or deployed.**

## UX delivered

When `VITE_FAMILY_OPERATING_MODES=true`, the currently signed-in **parent** has explicitly chosen `learning-support`, and the family ID is known, the existing Dashboard route (`/`) shows a Learning Support home instead of the standard dashboard. General Family / Custom keep the existing dashboard; children do not see the parent exception view.

The page has three sections:
1. **Needs your attention:** incomplete assignments linked to a known student in the selected family, overdue or due today through the following three days.
2. **Already organized:** confirmed as *entered in existing records*, upcoming assignments/events within 14 days, plus schoolwork marked completed within the prior seven days. "Organized" does not mean the underlying import has been independently verified.
3. **Worth reviewing:** family-scoped records with missing/invalid deadlines or event times. No guessed date, child identity or action.

Each item provides a link back to the existing Schoolwork or Calendar module (only when that module is enabled); the page has count totals and explicit empty states. No new records, reminders, messages or AI outputs are created.

## Data and safety contract

- `src/learning-support/summary.ts` is a pure, deterministic, read-only selector.
- Assignment has **no** `familyId` in the current app type. The selector only shows an assignment when its `studentId` joins to a student with `Student.familyId === currentUser.familyId`. Any assignment without a known same-family student is **excluded**, not assigned to the first student or matched by name.
- Event includes `familyId` and must match the signed-in user's current family. Invalid time/date shows a review card only if the family is verified.
- School email `actionItems`, classified messages, `BehaviorUpdate`, Document Vault text and school/clinical records **do not enter this view**. These data are browser-global or sensitive under current code; they need FOS-SEC-001 and the provenance/consent-based Family Intelligence gateway before cross-source aggregation.
- The UI reads app state only and has no mutations/side effects. A parent-only client role gate is not database authorization. The existing browser stores are still not fully family-isolated.
- If the user disables Schoolwork or Calendar, their items are excluded from this page, not deleted. No enabled routes lead to disabled modules.
- Background integrations/agent execution remain unchanged; there is no autonomous handling.
- Existing `VITE_FAMILY_OPERATING_MODES` flag remains off by default.

## Coverage

Unit tests in `src/learning-support/summary.test.ts` assert due-date buckets, completed work, missing/invalid dates and times, ISO timestamps, year boundaries, cross-family exclusion, unknown student, AI/import origin labeling, and absent family identity. CI builds the app both with default flag and `VITE_FAMILY_OPERATING_MODES=true`, and runs the existing mode tests plus new selector tests.

## Manual review checklist (isolated preview only)

1. Enable the mode flag on a non-production preview **without production service-role credentials**.
2. In General Family, verify existing dashboard and navigation still work exactly as before.
3. As a Parent switch to Learning Support. The root dashboard should display the three sections and correct child names/dates. Verify overdue and soon schoolwork separately from later upcoming events.
4. As a Child, verify the parent-only Learning Support overview never renders; the existing dashboard remains.
5. Disable Schoolwork or Calendar in Learning Support. Their cards should disappear, while stored records remain unchanged; hidden direct routes should still redirect.
6. Return to General Family. Check that original module selection and dashboard are preserved. Re-enter Learning Support and confirm per-mode toggles restore.
7. Test a record with invalid date, unknown child ID, or foreign `familyId` and verify no cross-household record appears.
8. Refresh; confirm local mode setting persisted for the same family only. Confirm no new network/API request, database mutation, or agent job from this dashboard.

## Next development (after review)

- FOS-SEC-001 remains the critical prerequisite to any persistence/agent processing of sensitive child-support data.
- Family Intelligence capture PR #2 contains a review-only school email prototype; secure identity + household-bound source persistence and explicit approval gateway are prerequisites before integrating a source-linked school communications inbox.
- Build scoped `decision_queue`/provenance metadata on the verified shared data layer, then add human-approved School Agent execution and longitudinal history.
