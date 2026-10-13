/**
 * FOS-001A — pure operating-mode model.
 * A mode configures a VIEW of existing Family OS modules. It is not a new
 * household, separate database, or permission grant.
 *
 * All current modules remain in the registry. Switching modes never deletes
 * stored data. Agent permissions are separate and default to NONE.
 */
export type OperatingModeId = 'general-family' | 'learning-support' | 'custom';

export interface OperatingModeDefinition {
  id: OperatingModeId;
  name: string;
  description: string;
  defaultModuleIds: readonly string[];
  dashboardKey: 'existing' | 'learning-support';
  navigationPreset: 'existing' | 'learning-support' | 'custom';
  /** Merely catalogued IDs. Enabling agents needs separate server authorization. */
  availableAgentIds: readonly string[];
}

export interface ModuleOverride {
  /** Optional per-mode overrides, never overwrite the legacy baseline. */
  enable?: readonly string[];
  disable?: readonly string[];
}

export interface OperatingModePreferencesV1 {
  version: 1;
  activeMode: OperatingModeId;
  /** Snapshot of the existing module selection, retained when changing modes. */
  generalFamilyModuleIds: readonly string[] | null;
  overrides: Partial<Record<OperatingModeId, ModuleOverride>>;
  /** Intentionally independent of module visibility and default OFF. */
  backgroundCapabilityIds: readonly string[];
}

export interface ModuleManifestEntry {
  id: string;
  defaultEnabled: boolean;
  canDisable: boolean;
  dependencies: readonly string[];
  route?: unknown;
}

export interface ModeResolution {
  activeMode: OperatingModeId;
  enabledModuleIds: string[];
  visibleRouteModuleIds: string[];
  backgroundCapabilityIds: string[];
  warnings: string[];
}
