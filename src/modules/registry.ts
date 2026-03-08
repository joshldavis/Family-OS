
import { ModuleDefinition, ModuleCategory } from './types';

import dashboard        from './definitions/dashboard';
import settings         from './definitions/settings';
import schoolwork       from './definitions/schoolwork';
import chores           from './definitions/chores';
import calendar         from './definitions/calendar';
import finance          from './definitions/finance';
import mealPlanning     from './definitions/mealPlanning';
import shopping         from './definitions/shopping';
import allowance        from './definitions/allowance';
import pinboard         from './definitions/pinboard';
import documents        from './definitions/documents';
import insights         from './definitions/insights';
import emailIntelligence from './definitions/emailIntelligence';
import aiScan           from './definitions/aiScan';

/**
 * Canonical ordered list of all modules.
 * Sidebar order follows this array — core first, then productivity in logical
 * order, integrations last, with settings always rendered at the bottom.
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  dashboard,
  schoolwork,
  chores,
  calendar,
  finance,
  mealPlanning,
  shopping,
  allowance,
  pinboard,
  documents,
  emailIntelligence,
  insights,
  aiScan,
  settings,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find(m => m.id === id);
}

export function getModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(m => m.category === category);
}

export function getDefaultEnabledModules(): string[] {
  return MODULE_REGISTRY.filter(m => m.defaultEnabled).map(m => m.id);
}

/**
 * Returns true if every dependency of the given module is present in
 * the provided `enabledModules` set.
 */
export function areDependenciesMet(moduleId: string, enabledModules: string[]): boolean {
  const mod = getModule(moduleId);
  if (!mod) return false;
  return (mod.dependencies ?? []).every(dep => enabledModules.includes(dep));
}

/**
 * Returns the IDs of all currently-enabled modules that declare a
 * dependency on the given moduleId.  Used when disabling a module to
 * find which other modules must also be disabled.
 */
export function getDependents(moduleId: string, enabledModules: string[]): string[] {
  return MODULE_REGISTRY
    .filter(m => enabledModules.includes(m.id) && (m.dependencies ?? []).includes(moduleId))
    .map(m => m.id);
}
