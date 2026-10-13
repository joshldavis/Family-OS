import { OPERATING_MODES } from './registry.ts';
import type {
  ModuleManifestEntry,
  ModeResolution,
  OperatingModeId,
  OperatingModePreferencesV1,
} from './types';

const VALID_MODES: readonly OperatingModeId[] = [
  'general-family', 'learning-support', 'custom',
];

/**
 * Pure, lossless adapter for the old `family_os_module_preferences` shape.
 * Neither this function nor the resolver writes to localStorage/Supabase.
 */
export function prepareLegacyModePreferences(
  oldPreferences: { enabledModules?: unknown } | null,
): OperatingModePreferencesV1 {
  const saved = oldPreferences?.enabledModules;
  const legacyIds =
    Array.isArray(saved) && saved.every(v => typeof v === 'string')
      ? [...saved] as string[]
      : null;

  return {
    version: 1,
    activeMode: 'general-family',
    generalFamilyModuleIds: legacyIds,
    overrides: {},
    backgroundCapabilityIds: [],
  };
}

/**
 * Return an updated mode *view* without modifying saved legacy data.
 * Only users who explicitly choose the mode should apply this result.
 */
export function selectOperatingMode(
  preferences: OperatingModePreferencesV1,
  mode: OperatingModeId,
): OperatingModePreferencesV1 {
  if (!VALID_MODES.includes(mode)) throw new Error('Unknown operating mode');
  return { ...preferences, activeMode: mode };
}

function makeManifestIndex(manifest: readonly ModuleManifestEntry[]): Map<string, ModuleManifestEntry> {
  const index = new Map<string, ModuleManifestEntry>();
  for (const module of manifest) {
    if (!module.id || index.has(module.id)) {
      throw new Error('Duplicate or empty module ID: ' + module.id);
    }
    index.set(module.id, module);
  }

  // Validate the COMPLETE manifest (not just active subset): fail closed on
  // missing dependencies and cycles rather than silently enabling bad routes.
  const done = new Set<string>();
  const path = new Set<string>();
  function visit(id: string): void {
    if (path.has(id)) throw new Error('Cyclic module dependency involving ' + id);
    if (done.has(id)) return;
    const module = index.get(id);
    if (!module) throw new Error('Unknown module dependency: ' + id);
    path.add(id);
    for (const dependency of module.dependencies) visit(dependency);
    path.delete(id);
    done.add(id);
  }
  for (const id of index.keys()) visit(id);
  return index;
}

/**
 * Stable, deterministic mode resolver.
 *
 * - Existing General Family preferences are never silently overwritten.
 * - An explicitly disabled dependency disables the dependent feature too.
 * - Core/non-disableable modules are always included.
 * - Only known registry IDs are rendered; unknown IDs remain in saved prefs
 *   for future recovery and are reported as warnings.
 * - Background capabilities and agents are NOT activated by mode switching.
 * - This function never deletes data, routes, or localStorage keys.
 */
export function resolveOperatingMode(
  preferences: OperatingModePreferencesV1,
  manifest: readonly ModuleManifestEntry[],
): ModeResolution {
  if (!VALID_MODES.includes(preferences.activeMode)) {
    throw new Error('Unknown operating mode');
  }
  const index = makeManifestIndex(manifest);
  const def = OPERATING_MODES[preferences.activeMode];
  const baseline: readonly string[] =
    preferences.activeMode === 'learning-support'
      ? def.defaultModuleIds
      : preferences.generalFamilyModuleIds ??
        manifest.filter(m => m.defaultEnabled).map(m => m.id);

  const overrides = preferences.overrides[preferences.activeMode] ?? {};
  const disabled = new Set(overrides.disable ?? []);
  const candidates = [...baseline, ...(overrides.enable ?? [])];
  const warnings: string[] = [];

  for (const value of [...candidates, ...disabled]) {
    if (!index.has(value)) warnings.push('Unknown module preserved in preferences: ' + value);
  }

  const enabled = new Set<string>();
  const tryAdd = (id: string): boolean => {
    const module = index.get(id);
    if (!module) return false;
    if (disabled.has(id) && module.canDisable) return false;

    // Compute a full dependency closure first. If one is explicitly disabled,
    // do not enable the dependent module or partially activate its dependencies.
    const proposed = new Set<string>();
    function collect(current: string): boolean {
      const next = index.get(current);
      if (!next) return false;
      if (disabled.has(current) && next.canDisable) return false;
      proposed.add(current);
      for (const dependency of next.dependencies) {
        if (!collect(dependency)) return false;
      }
      return true;
    }
    if (!collect(id)) {
      warnings.push('Module omitted because a required dependency is disabled: ' + id);
      return false;
    }
    for (const item of proposed) enabled.add(item);
    return true;
  };

  for (const candidate of candidates) tryAdd(candidate);

  // Core modules are never off, including when old settings omitted them.
  for (const module of manifest) {
    if (!module.canDisable) {
      if (disabled.has(module.id)) warnings.push('Core module cannot be disabled: ' + module.id);
      if (!tryAdd(module.id)) throw new Error('Unable to satisfy core module dependencies');
    }
  }

  const ordered = manifest.filter(m => enabled.has(m.id));
  if (preferences.backgroundCapabilityIds.length) {
    warnings.push('Background capabilities require separate verified permissions and remain off');
  }
  return {
    activeMode: preferences.activeMode,
    enabledModuleIds: ordered.map(m => m.id),
    visibleRouteModuleIds: ordered.filter(m => m.route != null).map(m => m.id),
    backgroundCapabilityIds: [], // independent opt-in + server auth in future
    warnings: [...new Set(warnings)],
  };
}
