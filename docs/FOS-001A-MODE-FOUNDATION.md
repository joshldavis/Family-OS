# FOS-001A — operating-mode foundation

**Status:** implemented as a pure, testable model in a draft PR. No UI or runtime integration is enabled. Main specification: [LEARNING-SUPPORT-MODE-SPEC.md](LEARNING-SUPPORT-MODE-SPEC.md).

## Files

- `src/modes/types.ts`: stable mode IDs and versioned preferences; visibility vs background permissions distinguished.
- `src/modes/registry.ts`: General Family, Learning Support and Custom definitions.
- `src/modes/resolver.ts`: validates module dependency graph, derives a deterministic enabled/visible set and protects legacy selection.
- `src/modes/resolver.test.ts`: regression tests (legacy migration, transitive dependencies, cycles, unknown modules, forbidden core disable, explicit mode switching and no automatic agent activation).

## Invariants

1. **Existing saved module selection wins** in General Family. A new `defaultEnabled` module cannot silently appear for a returning user due to a mode migration.
2. Switching to Learning Support changes **only the view** of available modules. Returning to General Family preserves the original module selections.
3. Mode selection **never** deletes browser data, documents, Supabase rows, route components or module registry entries.
4. A mode cannot become an authorization capability. `backgroundCapabilityIds` is always empty from the initial resolver; agents require separate server verification/consent.
5. A missing dependency or dependency cycle is an error, not a silently broken route. An explicitly disabled dependency removes its dependent module.
6. Disabled core modules are ignored with a warning; Dashboard/Settings remain visible.
7. Existing `family_os_module_preferences` is not rewritten by this PR.

## Integration strategy — future FOS-001B

- Add a versioned opt-in `family_os_operating_mode_preferences` store; load legacy `family_os_module_preferences` as fallback, do not overwrite it on first read.
- Introduce `ModeContext` as a pure view layer over current ModuleContext instead of replacing modules or hydration.
- Present mode selection in Settings with a preview/diff of visible modules; persist only when parent explicitly confirms.
- Ensure hidden routes cannot be accessed by direct navigation. Preserve browser state and all existing module data.
- Do not start background jobs because a mode requests a capability; require an independent verified authorization+consent policy.
- In Learning Support, add dedicated exception-based home shell after FOS-001B and only then child support models.
- FOS-SEC-001 must pass before persisting sensitive mode, support, observations or agent permissions to Supabase.
- Run accessibility, legacy offline user, switching back, refresh, route guard and multi-user/child-scope smoke tests.

## Notes

This PR deliberately leaves `src/modules/ModuleContext.tsx` and `src/App.tsx` untouched. It does not claim the mode selector or Learning Support dashboard is available to users yet. It does provide an isolated, repeatable foundation for those features without waiting for live database credentials.
