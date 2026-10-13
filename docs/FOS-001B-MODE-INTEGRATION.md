# FOS-001B — operating-mode Settings and navigation integration

**Status:** draft stacked PR on top of `feature/fos-001a-operating-modes-foundation`.
**Activation:** build-time flag `VITE_FAMILY_OPERATING_MODES=true` (OFF by default).
**No live Supabase changes**; no agents are enabled.

## User journey

1. A parent opens **Settings → Operating Mode** on an explicitly flagged deployment.
2. They choose **General Family**, **Learning Support**, or **Custom**. The selection is a PREVIEW only: it lists which modules would become visible or hidden.
3. They press **Apply mode** to change the local mode view. Sidebar links and routes now honor the selected mode; direct hidden-route visits redirect to Dashboard.
4. The user can change individual module toggles within that mode using the existing Settings module cards.
5. Switching back to **General Family** restores the original selections. Existing module records, browser state, and current household data are not removed.
6. The preference is stored under `family_os_operating_mode_preferences:v1:<encodedFamilyId>` for that family, never in the legacy `family_os_module_preferences` key. No cross-device sync is claimed.

## What changed

- `src/modes/ModeContext.tsx` layers mode-specific visibility over existing ModuleContext without rewriting the baseline.
- `src/modes/storage.ts` validates versioned, family-scoped local preferences and discards malicious background capability claims.
- `src/components/OperatingModeSettings.tsx` provides parent-only preview → Apply/Cancel UX.
- `src/App.tsx` uses mode-specific visible routes and remounts the scope on household change.
- `src/components/ModuleSettings.tsx` applies toggles to active mode only.
- `src/pages/Settings.tsx` shows the selector when flagged.
- `src/modules/ModuleContext.tsx` stops auto-enabling newly defaulted modules for returning users only when mode flag is on; legacy behavior remains unchanged when off.
- Unit tests verify mode-local persistence, legacy baseline preservation, corrupted preference fallback, family isolation and background capabilities default-off. CI additionally validates app build.

## Security and functional boundaries

- UI mode permissions are **not** server-side authorization. A local role check prevents unintended changes through the Settings UI, but child/caregiver data access must be enforced by the server/RLS before a sensitive pilot.
- Mode selection does not start or stop cron jobs or integration pollers. Background capabilities remain independent and unactivated; hidden nav does NOT mean private data has been secured.
- **Learning Support currently changes module visibility only**, not the dashboard content. FOS-001C will build an exceptions-first dashboard using existing safe family context, plus decision queue/review links.
- The mode setting is LOCAL to the current device and family. Cross-device persistence requires a later verified Supabase settings service.
- The **legacy** `family_os_module_preferences` store is still global within the browser, so General Family module choices can be shared across households on the same device. This PR scopes only the new operating-mode overrides. Do not claim full cross-household browser isolation until all older stores are migrated to family-specific keys.
- The whole feature is OFF unless the build-time flag is explicitly set. No production changes are performed by this PR.
- The FOS-001A mode resolver branch is a prerequisite; this PR is stacked on it.

## Manual preview test script

Build with `VITE_FAMILY_OPERATING_MODES=true` in a non-production preview environment (never include service-role credentials in the browser).

1. Login or onboard in demo mode as a Parent. Set Finance ON and Schoolwork OFF in General Family.
2. Change to Learning Support; confirm preview shows school modules and hides Finance. Apply.
3. Navigate directly to the hidden Finance route (`#/finance`). Confirm redirect to Dashboard.
4. Change an enabled Learning Support module OFF. Switch back to General Family; confirm original Finance ON, Schoolwork OFF settings are restored and data remain intact.
5. Switch to Custom; toggle a module. Refresh. Confirm active Custom mode and its toggles remain on the same device.
6. Switch to another family account; confirm another family's modes are not used.
7. Confirm no agent/background task automatically starts when choosing Learning Support. Inspect Supabase: there should be no mode-related writes.
8. Unset the flag, rebuild. Confirm Settings/Sidebar/modules behave exactly as before.

Do not merge/enable for families with sensitive child support records until role scope and live database isolation are proven.
