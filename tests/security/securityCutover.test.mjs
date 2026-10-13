import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const proposal = read('../../supabase/proposals/fos_sec_001_household_lockdown.sql');
const cutover = read('../../docs/SECURITY-CUTOVER-PLAN.md');
const verification = read('../../supabase/proposals/fos_sec_001_verify.sql');

test('FOS-SEC-001 proposal removes permissive enrollment and broad update policies', () => {
  assert.match(proposal, /drop policy if exists "anyone can insert a family \(during onboarding\)"/i);
  assert.match(proposal, /drop policy if exists "profiles: insert \(onboarding\)"/i);
  assert.match(proposal, /drop policy if exists "profiles: update own family"/i);
  assert.match(proposal, /drop policy if exists "family members can update their family"/i);
  assert.match(proposal, /revoke insert, update, delete on table public\.families\s+from public, anon, authenticated/i);
  assert.match(proposal, /revoke insert, update, delete on table public\.profiles\s+from public, anon, authenticated/i);
});

test('security proposal cannot be inadvertently included in migrations', () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const migrations = existsSync(dir) ? readdirSync(dir) : [];
  assert.equal(migrations.some(file => file.toLowerCase().includes('fos_sec_001')), false);
  assert.match(cutover, /not (yet )?verified|not deployed|not yet verified/i);
  assert.match(proposal, /DO NOT execute in production/i);
});

test('verification explicitly checks untrusted insert/update/delete grants', () => {
  for (const table of ['families', 'profiles']) {
    assert.match(verification, new RegExp('public\\.' + table));
  }
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
    assert.match(verification, new RegExp('authenticated.*' + privilege));
  }
});

test('deployment plan requires safe join flow before lockdown', () => {
  assert.match(cutover, /server.*(invite|invitation)/i);
  assert.match(cutover, /backup/i);
  assert.match(cutover, /disposable database/i);
  assert.match(cutover, /existing legitimate family members/i);
});
