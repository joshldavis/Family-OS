import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { Role } from '../types';
import { useFamily } from '../FamilyContext';
import { useModules } from '../modules/ModuleContext';
import { getModule } from '../modules/registry';
import type { ModuleDefinition } from '../modules/types';
import { getOperatingModeDefinition } from './registry';
import { resolveOperatingMode, selectOperatingMode } from './resolver';
import { loadModePreferences, saveModePreferences } from './storage';
import type { ModeResolution, OperatingModeId, OperatingModePreferencesV1 } from './types';

/**
 * Preview opt-in only. Existing deployments keep the old ModuleContext
 * behavior and do not create a mode preference key when unset.
 */
export const OPERATING_MODES_ENABLED =
  import.meta.env.VITE_FAMILY_OPERATING_MODES === 'true';

interface ModeContextValue {
  featureEnabled: boolean;
  activeMode: OperatingModeId;
  canChangeMode: boolean;
  modeName: string;
  allModules: ModuleDefinition[];
  enabledModules: string[];
  isEnabled: (id: string) => boolean;
  getEnabledRoutes: () => ModuleDefinition[];
  previewMode: (mode: OperatingModeId) => ModeResolution;
  changeMode: (mode: OperatingModeId) => void;
  toggleModule: (moduleId: string) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

/**
 * The ModuleContext baseline is NEVER modified by non-General mode changes.
 * Mode switching changes only which modules are visible (and, for Custom or
 * Learning Support, separate local-only overrides). This preserves all
 * existing data, General Family module selections and background jobs.
 */
export const ModeProvider: React.FC<{
  familyId: string | null;
  children: React.ReactNode;
}> = ({ familyId, children }) => {
  const modules = useModules();
  const { state } = useFamily();
  const [preferences, setPreferences] = useState<OperatingModePreferencesV1>(
    () => OPERATING_MODES_ENABLED
      ? loadModePreferences(familyId, localStorage)
      : loadModePreferences(null, localStorage),
  );

  const canChangeMode =
    OPERATING_MODES_ENABLED &&
    Boolean(familyId) &&
    state.currentUser?.familyId === familyId &&
    state.currentUser?.role === Role.PARENT;

  const baseline = useMemo<OperatingModePreferencesV1>(
    () => ({
      ...preferences,
      // ModuleContext is the source of truth for General Family.
      generalFamilyModuleIds: modules.enabledModules,
      backgroundCapabilityIds: [],
    }),
    [preferences, modules.enabledModules],
  );

  const result = useMemo(
    () => OPERATING_MODES_ENABLED && familyId
      ? resolveOperatingMode(baseline, modules.allModules)
      : null,
    [baseline, modules.allModules, familyId],
  );

  const activeMode: OperatingModeId =
    result?.activeMode ?? 'general-family';
  const enabledModules = result?.enabledModuleIds ?? modules.enabledModules;

  const enabledSet = useMemo(() => new Set(enabledModules), [enabledModules]);
  const isEnabled = useCallback((id: string) => enabledSet.has(id), [enabledSet]);
  const getEnabledRoutes = useCallback(
    () => modules.allModules.filter(m => enabledSet.has(m.id) && m.route != null),
    [modules.allModules, enabledSet],
  );

  useEffect(() => {
    if (OPERATING_MODES_ENABLED && familyId && canChangeMode) {
      // Uses a separate family-scoped key; never touches existing module data.
      saveModePreferences(familyId, preferences, localStorage);
    }
  }, [familyId, canChangeMode, preferences]);

  const previewMode = useCallback(
    (mode: OperatingModeId): ModeResolution => {
      if (!OPERATING_MODES_ENABLED || !familyId) {
        return resolveOperatingMode({
          ...baseline, activeMode: 'general-family',
        }, modules.allModules);
      }
      return resolveOperatingMode(selectOperatingMode(baseline, mode), modules.allModules);
    },
    [baseline, modules.allModules, familyId],
  );

  const changeMode = useCallback((mode: OperatingModeId) => {
    if (!canChangeMode) return;
    setPreferences(prev => selectOperatingMode(prev, mode));
  }, [canChangeMode]);

  const toggleModule = useCallback((id: string) => {
    const module = getModule(id);
    if (!module || !module.canDisable) return;
    if (!OPERATING_MODES_ENABLED) {
      modules.toggleModule(id);
      return;
    }
    if (!canChangeMode) return;
    if (activeMode === 'general-family') {
      // Existing module settings continue to own the original selection.
      modules.toggleModule(id);
      return;
    }

    const turningOff = enabledSet.has(id);
    setPreferences(prev => {
      const existing = prev.overrides[activeMode] ?? {};
      const enable = new Set(existing.enable ?? []);
      const disable = new Set(existing.disable ?? []);
      if (turningOff) {
        enable.delete(id);
        disable.add(id);
      } else {
        disable.delete(id);
        enable.add(id);
      }
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [activeMode]: { enable: [...enable], disable: [...disable] },
        },
      };
    });
  }, [activeMode, canChangeMode, enabledSet, modules]);

  const value: ModeContextValue = {
    featureEnabled: OPERATING_MODES_ENABLED,
    activeMode,
    canChangeMode,
    modeName: getOperatingModeDefinition(activeMode).name,
    allModules: modules.allModules,
    enabledModules,
    isEnabled,
    getEnabledRoutes,
    previewMode,
    changeMode,
    toggleModule,
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

export function useModeModules(): ModeContextValue {
  const value = useContext(ModeContext);
  if (!value) throw new Error('useModeModules requires <ModeProvider>.');
  return value;
}
