import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLegacyModePreferences, resolveOperatingMode, selectOperatingMode } from './resolver.ts';
import type { ModuleManifestEntry, OperatingModePreferencesV1 } from './types.ts';

const fixture: ModuleManifestEntry[] = [
  { id: 'dashboard', defaultEnabled: true, canDisable: false, dependencies: [], route: '/' },
  { id: 'schoolwork', defaultEnabled: true, canDisable: true, dependencies: [], route: '/school' },
  { id: 'calendar', defaultEnabled: true, canDisable: true, dependencies: [], route: '/calendar' },
  { id: 'documents', defaultEnabled: true, canDisable: true, dependencies: [], route: '/documents' },
  { id: 'family-coach', defaultEnabled: true, canDisable: true, dependencies: ['documents'], route: '/coach' },
  { id: 'email-intelligence', defaultEnabled: true, canDisable: true, dependencies: [], route: '/email' },
  { id: 'daily-agenda', defaultEnabled: true, canDisable: true, dependencies: [], route: '/agenda' },
  { id: 'finance', defaultEnabled: true, canDisable: true, dependencies: [], route: '/finance' },
  { id: 'new-module', defaultEnabled: true, canDisable: true, dependencies: [], route: '/new' },
  { id: 'ai-scan', defaultEnabled: true, canDisable: true, dependencies: [] },
  { id: 'settings', defaultEnabled: true, canDisable: false, dependencies: [], route: '/settings' },
];

const make = (old: string[] | null): OperatingModePreferencesV1 =>
  prepareLegacyModePreferences(old === null ? null : { enabledModules: old });

test('legacy module selection becomes General Family without rewriting or auto-enabling new defaults', () => {
  const old = ['schoolwork', 'finance'];
  const prefs = make(old);
  const result = resolveOperatingMode(prefs, fixture);
  assert.deepEqual(result.enabledModuleIds, ['dashboard', 'schoolwork', 'finance', 'settings']);
  assert.equal(result.enabledModuleIds.includes('new-module'), false);
  assert.deepEqual(old, ['schoolwork', 'finance']);
  assert.equal(prefs.activeMode, 'general-family');
});

test('a truly new household receives registry defaults', () => {
  const prefs = make(null);
  const result = resolveOperatingMode(prefs, fixture);
  assert.ok(result.enabledModuleIds.includes('new-module'));
  assert.equal(result.enabledModuleIds.includes('settings'), true);
  assert.equal(result.enabledModuleIds.includes('ai-scan'), true);
  assert.equal(result.visibleRouteModuleIds.includes('ai-scan'), false);
});

test('Learning Support mode is optional and reuses existing modules without mutating General Family baseline', () => {
  const prefs = make(['finance', 'dashboard']);
  const support = selectOperatingMode(prefs, 'learning-support');
  const selected = resolveOperatingMode(support, fixture);
  assert.ok(selected.enabledModuleIds.includes('family-coach'));
  assert.ok(selected.enabledModuleIds.includes('documents'));
  assert.ok(selected.enabledModuleIds.includes('email-intelligence'));
  assert.equal(selected.enabledModuleIds.includes('finance'), false);
  assert.deepEqual(resolveOperatingMode(prefs, fixture).enabledModuleIds, ['dashboard', 'finance', 'settings']);
  assert.deepEqual(support.generalFamilyModuleIds, ['finance', 'dashboard']);
});

test('Custom mode uses the legacy selection plus explicit per-mode overrides', () => {
  const prefs: OperatingModePreferencesV1 = {
    ...make(['schoolwork', 'finance']),
    activeMode: 'custom',
    overrides: { custom: { enable: ['calendar'], disable: ['finance'] } },
  };
  assert.deepEqual(resolveOperatingMode(prefs, fixture).enabledModuleIds,
    ['dashboard', 'schoolwork', 'calendar', 'settings']);
});

test('explicitly disabling a dependency removes its dependent module', () => {
  const prefs: OperatingModePreferencesV1 = {
    ...make(['family-coach']),
    overrides: { 'general-family': { disable: ['documents'] } },
  };
  const result = resolveOperatingMode(prefs, fixture);
  assert.equal(result.enabledModuleIds.includes('family-coach'), false);
  assert.equal(result.enabledModuleIds.includes('documents'), false);
  assert.ok(result.warnings.some(w => w.includes('dependency')));
});

test('transitive dependencies resolve, missing dependencies fail, cycles fail', () => {
  const extended = [...fixture, { id: 'third', defaultEnabled: false, canDisable: true,
    dependencies: ['second'], route: '/third' },
  { id: 'second', defaultEnabled: false, canDisable: true, dependencies: ['schoolwork'] }];
  const prefs = make(['third']);
  const result = resolveOperatingMode(prefs, extended);
  assert.ok(result.enabledModuleIds.includes('schoolwork'));
  assert.ok(result.enabledModuleIds.includes('second'));
  assert.ok(result.enabledModuleIds.includes('third'));
  assert.throws(() => resolveOperatingMode(prefs, [
    ...fixture, { id: 'bad', defaultEnabled: false, canDisable: true, dependencies: ['absent'] },
  ]), /Unknown module dependency/);
  assert.throws(() => resolveOperatingMode(prefs, [
    ...fixture, { id: 'x', defaultEnabled: false, canDisable: true, dependencies: ['y'] },
    { id: 'y', defaultEnabled: false, canDisable: true, dependencies: ['x'] },
  ]), /Cyclic module dependency/);
});

test('unknown legacy module IDs are reported but preserved in saved preferences', () => {
  const prefs = make(['retired-module', 'schoolwork']);
  const result = resolveOperatingMode(prefs, fixture);
  assert.equal(result.enabledModuleIds.includes('retired-module'), false);
  assert.deepEqual(prefs.generalFamilyModuleIds, ['retired-module', 'schoolwork']);
  assert.ok(result.warnings.some(w => w.includes('retired-module')));
});

test('core modules cannot be disabled by overrides', () => {
  const prefs: OperatingModePreferencesV1 = {
    ...make([]), overrides: { 'general-family': { disable: ['dashboard', 'settings'] } },
  };
  const result = resolveOperatingMode(prefs, fixture);
  assert.ok(result.enabledModuleIds.includes('dashboard'));
  assert.ok(result.enabledModuleIds.includes('settings'));
  assert.ok(result.warnings.some(w => w.includes('Core module')));
});

test('requested background capabilities are not activated from mode settings', () => {
  const prefs: OperatingModePreferencesV1 = {
    ...make([]), backgroundCapabilityIds: ['school-email-autopilot'],
  };
  const result = resolveOperatingMode(prefs, fixture);
  assert.deepEqual(result.backgroundCapabilityIds, []);
  assert.ok(result.warnings.some(w => w.includes('permissions')));
});

test('invalid operating mode IDs and duplicate module IDs fail closed', () => {
  const prefs = make([]);
  assert.throws(() => selectOperatingMode(prefs, 'typo' as never), /Unknown operating mode/);
  assert.throws(() => resolveOperatingMode({ ...prefs, activeMode: 'typo' as never }, fixture), /Unknown operating mode/);
  assert.throws(() => resolveOperatingMode(prefs, [...fixture, fixture[0]]), /Duplicate or empty module ID/);
});

test('defensive migration tolerates corrupt saved preferences without destroying them', () => {
  const prefs = prepareLegacyModePreferences({ enabledModules: 'not-an-array' });
  assert.equal(prefs.generalFamilyModuleIds, null);
  assert.equal(prefs.activeMode, 'general-family');
});
