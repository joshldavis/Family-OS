import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const modes = readFileSync(new URL('./ModeContext.tsx', import.meta.url), 'utf8');

test('mode visibility cannot enable Daily Agenda background prewarming', () => {
  // Switching into Learning Support can show Daily Agenda in navigation.
  // Only the pre-existing ModuleContext preference may enable prewarming.
  assert.match(app, /isEnabled:\s*isLegacyModuleEnabled\s*}\s*=\s*useModules\(\)/);
  assert.match(app, /enabled:\s*isLegacyModuleEnabled\('daily-agenda'\)/);
  assert.match(app, /isLegacyModuleEnabled\('daily-agenda'\)\s*\?\s*\(profile\?\.users/);
  assert.doesNotMatch(app, /enabled:\s*isEnabled\('daily-agenda'\)/);
});

test('operating-mode context does not start polling or call an AI provider', () => {
  assert.doesNotMatch(modes, /setInterval\s*\(/);
  assert.doesNotMatch(modes, /fetch\s*\(/);
  assert.doesNotMatch(modes, /generateContent\s*\(/);
});
