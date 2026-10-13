import type { OperatingModePreferencesV1, OperatingModeId, ModuleOverride } from './types';
import { prepareLegacyModePreferences } from './resolver';

const STORAGE_PREFIX = 'family_os_operating_mode_preferences:v1:';
const VALID_MODES = new Set<OperatingModeId>(['general-family', 'learning-support', 'custom']);

export interface ModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getModeStorageKey(familyId: string): string {
  if (!familyId.trim()) throw new Error('Cannot persist an operating mode without a family.');
  return STORAGE_PREFIX + encodeURIComponent(familyId);
}

/**
 * Invalid/legacy preference payloads fall back to General Family, preserving
 * the existing ModuleContext data. No client-stored setting grants permission.
 */
export function decodeModePreferences(raw: string | null): OperatingModePreferencesV1 {
  const fallback = prepareLegacyModePreferences(null);
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return fallback;
    const obj = value as Record<string, unknown>;
    if (obj.version !== 1 || !VALID_MODES.has(obj.activeMode as OperatingModeId)) return fallback;
    const overrides: OperatingModePreferencesV1['overrides'] = {};
    if (obj.overrides != null) {
      if (typeof obj.overrides !== 'object' || Array.isArray(obj.overrides)) return fallback;
      const saved = obj.overrides as Record<string, ModuleOverride>;
      for (const mode of VALID_MODES) {
        const entry = saved[mode];
        if (!entry) continue;
        if (typeof entry !== 'object' || Array.isArray(entry)) return fallback;
        if (entry.enable != null && (!Array.isArray(entry.enable) ||
            !entry.enable.every(x => typeof x === 'string'))) return fallback;
        if (entry.disable != null && (!Array.isArray(entry.disable) ||
            !entry.disable.every(x => typeof x === 'string'))) return fallback;
        overrides[mode] = {
          enable: entry.enable ? [...entry.enable] : [],
          disable: entry.disable ? [...entry.disable] : [],
        };
      }
    }
    // The General Family baseline is always read from existing ModuleContext,
    // not from a potentially stale snapshot stored by operating modes.
    return {
      version: 1,
      activeMode: obj.activeMode as OperatingModeId,
      generalFamilyModuleIds: null,
      overrides,
      backgroundCapabilityIds: [], // explicitly opt-in and authorized later
    };
  } catch {
    return fallback;
  }
}

export function loadModePreferences(familyId: string | null, storage: ModeStorage): OperatingModePreferencesV1 {
  if (!familyId) return prepareLegacyModePreferences(null);
  try {
    return decodeModePreferences(storage.getItem(getModeStorageKey(familyId)));
  } catch {
    return prepareLegacyModePreferences(null);
  }
}

/** Save *only* the separate mode key. Never overwrite legacy module settings. */
export function saveModePreferences(
  familyId: string | null,
  preferences: OperatingModePreferencesV1,
  storage: ModeStorage,
): boolean {
  if (!familyId) return false;
  try {
    storage.setItem(getModeStorageKey(familyId), JSON.stringify({
      version: 1,
      activeMode: preferences.activeMode,
      overrides: preferences.overrides,
      backgroundCapabilityIds: [], // no agent activation through modes
    }));
    return true;
  } catch {
    // Storage may be unavailable: in-memory mode still works this session.
    return false;
  }
}
