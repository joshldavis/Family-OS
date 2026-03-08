
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ModuleDefinition } from './types';
import {
  MODULE_REGISTRY,
  getModule,
  getDefaultEnabledModules,
  areDependenciesMet,
  getDependents,
} from './registry';

// ── Storage key ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'family_os_module_preferences';

function loadFromStorage(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { enabledModules: string[] };
    return Array.isArray(parsed.enabledModules) ? parsed.enabledModules : null;
  } catch {
    return null;
  }
}

function saveToStorage(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabledModules: ids }));
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface ModuleContextValue {
  /** IDs of all currently enabled modules */
  enabledModules: string[];
  /** Full registry — all modules, enabled or not */
  allModules: ModuleDefinition[];
  isEnabled: (id: string) => boolean;
  /** Modules that are currently enabled (full definitions) */
  getEnabledModules: () => ModuleDefinition[];
  /** Enabled modules that have a route, in registry order */
  getEnabledRoutes: () => ModuleDefinition[];
  enableModule: (id: string) => void;
  disableModule: (id: string) => void;
  toggleModule: (id: string) => void;
  /** Bulk replace — used by onboarding */
  setEnabledModules: (ids: string[]) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabledModules, setEnabledModulesState] = useState<string[]>(() => {
    // Always ensure core modules are present regardless of stored prefs
    const stored = loadFromStorage();
    const base = stored ?? getDefaultEnabledModules();
    const coreIds = MODULE_REGISTRY.filter(m => !m.canDisable).map(m => m.id);
    const merged = Array.from(new Set([...coreIds, ...base]));
    return merged;
  });

  // Persist every time enabled set changes
  useEffect(() => {
    saveToStorage(enabledModules);
  }, [enabledModules]);

  const isEnabled = useCallback((id: string) => enabledModules.includes(id), [enabledModules]);

  const getEnabledModules = useCallback(
    () => MODULE_REGISTRY.filter(m => enabledModules.includes(m.id)),
    [enabledModules],
  );

  const getEnabledRoutes = useCallback(
    () => MODULE_REGISTRY.filter(m => enabledModules.includes(m.id) && m.route != null),
    [enabledModules],
  );

  const enableModule = useCallback((id: string) => {
    const mod = getModule(id);
    if (!mod) return;
    // Auto-enable unmet dependencies first
    const depsToEnable = mod.dependencies.filter(dep => !enabledModules.includes(dep));
    setEnabledModulesState(prev => Array.from(new Set([...prev, ...depsToEnable, id])));
    mod.onEnable?.();
  }, [enabledModules]);

  const disableModule = useCallback((id: string) => {
    const mod = getModule(id);
    if (!mod || !mod.canDisable) return; // core modules are immutable

    // Also disable any enabled modules that depend on this one
    const dependents = getDependents(id, enabledModules);
    setEnabledModulesState(prev =>
      prev.filter(mid => mid !== id && !dependents.includes(mid)),
    );
    mod.onDisable?.();
  }, [enabledModules]);

  const toggleModule = useCallback((id: string) => {
    if (enabledModules.includes(id)) {
      disableModule(id);
    } else {
      enableModule(id);
    }
  }, [enabledModules, enableModule, disableModule]);

  const setEnabledModules = useCallback((ids: string[]) => {
    // Always keep core modules
    const coreIds = MODULE_REGISTRY.filter(m => !m.canDisable).map(m => m.id);
    const merged = Array.from(new Set([...coreIds, ...ids]));
    setEnabledModulesState(merged);
  }, []);

  return (
    <ModuleContext.Provider value={{
      enabledModules,
      allModules: MODULE_REGISTRY,
      isEnabled,
      getEnabledModules,
      getEnabledRoutes,
      enableModule,
      disableModule,
      toggleModule,
      setEnabledModules,
    }}>
      {children}
    </ModuleContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useModules(): ModuleContextValue {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error('useModules must be used inside <ModuleProvider>');
  return ctx;
}
