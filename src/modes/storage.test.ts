import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeModePreferences, getModeStorageKey,
  loadModePreferences, saveModePreferences,
} from './storage.ts';
import { resolveOperatingMode, selectOperatingMode } from './resolver.ts';
import type { ModuleManifestEntry, OperatingModePreferencesV1 } from './types.ts';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    entries: () => [...map.entries()],
  };
}
const fixture: ModuleManifestEntry[] = [
  { id: 'dashboard', defaultEnabled: true, canDisable: false, dependencies: [], route: '/' },
  { id: 'finance', defaultEnabled: true, canDisable: true, dependencies: [], route: '/finance' },
  { id: 'schoolwork', defaultEnabled: true, canDisable: true, dependencies: [], route: '/schoolwork' },
  { id: 'calendar', defaultEnabled: true, canDisable: true, dependencies: [], route: '/calendar' },
  { id: 'documents', defaultEnabled: true, canDisable: true, dependencies: [], route: '/documents' },
  { id: 'family-coach', defaultEnabled: true, canDisable: true, dependencies: ['documents'], route: '/coach' },
  { id: 'email-intelligence', defaultEnabled: true, canDisable: true, dependencies: [], route: '/email' },
  { id: 'daily-agenda', defaultEnabled: true, canDisable: true, dependencies: [], route: '/agenda' },
  { id: 'settings', defaultEnabled: true, canDisable: false, dependencies: [], route: '/settings' },
];

const initial: OperatingModePreferencesV1 = {
  version: 1,
  activeMode: 'general-family',
  generalFamilyModuleIds: ['dashboard', 'finance', 'settings'],
  overrides: {},
  backgroundCapabilityIds: [],
};

test('mode preferences are isolated by family id and never overwrite legacy module keys', () => {
  const storage = fakeStorage();
  const familyA = selectOperatingMode(initial, 'learning-support');
  assert.equal(saveModePreferences('family-A', familyA, storage), true);
  assert.equal(loadModePreferences('family-A', storage).activeMode, 'learning-support');
  assert.equal(loadModePreferences('family-B', storage).activeMode, 'general-family');
  assert.deepEqual(storage.entries().map(([key]) => key), [getModeStorageKey('family-A')]);
  assert.ok(!storage.entries()[0][0].includes('module_preferences'));
});

test('offline/signed-out mode never saves a preference', () => {
  const storage = fakeStorage();
  assert.equal(saveModePreferences(null, initial, storage), false);
  assert.equal(loadModePreferences(null, storage).activeMode, 'general-family');
  assert.equal(storage.entries().length, 0);
});

test('tampered/unknown mode state does not activate any background capability', () => {
  const raw = JSON.stringify({
    version: 1, activeMode: 'learning-support',
    backgroundCapabilityIds: ['auto-send-school-messages'],
    overrides: { 'learning-support': { enable: ['finance'], disable: [] } },
  });
  const decoded = decodeModePreferences(raw);
  assert.equal(decoded.activeMode, 'learning-support');
  assert.deepEqual(decoded.backgroundCapabilityIds, []);
  assert.deepEqual(decoded.overrides['learning-support']?.enable, ['finance']);
});

test('corrupted and unsupported settings fail closed to original General Family', () => {
  for (const raw of [
    'not JSON', 'null', JSON.stringify({ version: 5, activeMode: 'learning-support' }),
    JSON.stringify({ version: 1, activeMode: 'danger' }),
    JSON.stringify({ version: 1, activeMode: 'learning-support', overrides: { 'learning-support': { enable: 'everything' } } }),
  ]) {
    assert.equal(decodeModePreferences(raw).activeMode, 'general-family');
  }
});

test('returning to General Family keeps legacy module selection after Learning Support', () => {
  const storage = fakeStorage();
  const baseline = ['dashboard', 'finance', 'settings'];
  const special = selectOperatingMode(initial, 'learning-support');
  saveModePreferences('family-A', special, storage);
  const stored = loadModePreferences('family-A', storage);
  const support = resolveOperatingMode({
    ...stored, generalFamilyModuleIds: baseline,
  }, fixture);
  assert.equal(support.enabledModuleIds.includes('schoolwork'), true);
  assert.equal(support.enabledModuleIds.includes('finance'), false);
  const general = resolveOperatingMode({
    ...selectOperatingMode(stored, 'general-family'),
    generalFamilyModuleIds: baseline,
  }, fixture);
  assert.deepEqual(general.enabledModuleIds, baseline);
  assert.deepEqual(baseline, ['dashboard', 'finance', 'settings']);
});

test('mode-local overrides persist without changing original General Family selections', () => {
  const storage = fakeStorage();
  const custom: OperatingModePreferencesV1 = {
    ...initial, activeMode: 'custom',
    overrides: { custom: { disable: ['finance'], enable: ['calendar'] } },
  };
  saveModePreferences('family-A', custom, storage);
  const saved = loadModePreferences('family-A', storage);
  const withLegacyBaseline = { ...saved, generalFamilyModuleIds: initial.generalFamilyModuleIds };
  assert.deepEqual(resolveOperatingMode(withLegacyBaseline, fixture).enabledModuleIds,
    ['dashboard', 'calendar', 'settings']);
  assert.deepEqual(resolveOperatingMode({
    ...withLegacyBaseline, activeMode: 'general-family',
  }, fixture).enabledModuleIds, ['dashboard', 'finance', 'settings']);
});
