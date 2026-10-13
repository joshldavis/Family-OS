import type { OperatingModeDefinition, OperatingModeId } from './types';

const GENERAL_FAMILY: OperatingModeDefinition = {
  id: 'general-family',
  name: 'General Family',
  description: 'The existing Family OS experience with all current module choices retained.',
  defaultModuleIds: [], // Resolver delegates to current registry/default or saved legacy preference.
  dashboardKey: 'existing',
  navigationPreset: 'existing',
  availableAgentIds: [], // No agents are automatically enabled in any mode.
};

const LEARNING_SUPPORT: OperatingModeDefinition = {
  id: 'learning-support',
  name: 'Learning Support',
  description: 'An exception-oriented view of school, learning supports, documents and family commitments.',
  defaultModuleIds: [
    'dashboard', 'schoolwork', 'calendar', 'documents', 'family-coach',
    'email-intelligence', 'daily-agenda', 'settings',
  ],
  dashboardKey: 'learning-support',
  navigationPreset: 'learning-support',
  availableAgentIds: ['school', 'learning-regulation', 'advocacy-planning'],
};

const CUSTOM: OperatingModeDefinition = {
  id: 'custom',
  name: 'Custom',
  description: 'Choose which existing Family OS modules appear.',
  defaultModuleIds: [], // Uses saved legacy selection unless explicit custom overrides provided.
  dashboardKey: 'existing',
  navigationPreset: 'custom',
  availableAgentIds: [],
};

export const OPERATING_MODES: Readonly<Record<OperatingModeId, OperatingModeDefinition>> = {
  'general-family': GENERAL_FAMILY,
  'learning-support': LEARNING_SUPPORT,
  custom: CUSTOM,
};

export function getOperatingModeDefinition(id: OperatingModeId): OperatingModeDefinition {
  return OPERATING_MODES[id];
}
