
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabledModules: ids }));
  } catch {
    // Storage may be unavailable (QuotaExceededError, private browsing) — fail silently
  }
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
    // Any new module added with defaultEnabled:true should auto-activate even
    // for users who already have stored preferences (first-launch auto-opt-in).
    const newDefaultIds = MODULE_REGISTRY
      .filter(m => m.defaultEnabled && m.canDisable && stored !== null && !base.includes(m.id))
      .map(m => m.id);
    const merged = Array.from(new Set([...coreIds, ...base, ...newDefaultIds]));
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
    // Track whether the module was actually newly enabled so side-effect fires exactly once
    let shouldFireOnEnable = false;
    setEnabledModulesState(prev => {
      if (prev.includes(id)) return prev; // already enabled — no-op
      shouldFireOnEnable = true;
      const depsToEnable = (mod.dependencies ?? []).filter(dep => !prev.includes(dep));
      return Array.from(new Set([...prev, ...depsToEnable, id]));
    });
    // Side effect lives outside the updater (updaters must be pure)
    if (shouldFireOnEnable) mod.onEnable?.();
  }, []);

  const disableModule = useCallback((id: string) => {
    const mod = getModule(id);
    if (!mod || !mod.canDisable) return; // core modules are immutable

    // Track whether the module was actually removed before firing the side effect
    let wasEnabled = false;
    setEnabledModulesState(prev => {
      wasEnabled = prev.includes(id);
      if (!wasEnabled) return prev;
      const dependents = getDependents(id, prev);
      return prev.filter(mid => mid !== id && !dependents.includes(mid));
    });
    if (wasEnabled) mod.onDisable?.();
  }, []);

  const toggleModule = useCallback((id: string) => {
    const mod = getModule(id);
    if (!mod) return;

    // Determine the action inside the updater (using prev, not stale closure state)
    // and store it so the side-effect can fire correctly outside the updater.
    let action: 'enabled' | 'disabled' | 'none' = 'none';
    setEnabledModulesState(prev => {
      const isCurrentlyEnabled = prev.includes(id);
      if (isCurrentlyEnabled) {
        if (!mod.canDisable) return prev;
        action = 'disabled';
        const dependents = getDependents(id, prev);
        return prev.filter(mid => mid !== id && !dependents.includes(mid));
      } else {
        action = 'enabled';
        const depsToEnable = (mod.dependencies ?? []).filter(dep => !prev.includes(dep));
        return Array.from(new Set([...prev, ...depsToEnable, id]));
      }
    });

    // Side effects run exactly once, driven by the updater's decision (not stale closure)
    // Cast needed because TS can't track mutations inside the functional updater callback
    const resolvedAction = action as 'enabled' | 'disabled' | 'none';
    if (resolvedAction === 'enabled') mod.onEnable?.();
    else if (resolvedAction === 'disabled') mod.onDisable?.();
  }, []);

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
