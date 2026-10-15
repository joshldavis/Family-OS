import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const intake = readFileSync(new URL('../components/SchoolAgentIntakeSandbox.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/LearningSupportHome.tsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../../api/_lib/schoolAgentApprovalPreview.ts', import.meta.url), 'utf8');

test('School Agent intake is a separate opt-in and never runs for children or other modes', () => {
  assert.match(page, /VITE_FAMILY_SCHOOL_AGENT_SANDBOX === 'true'/);
  assert.match(intake, /state\.currentUser\?\.role === Role\.PARENT/);
  assert.match(intake, /activeMode === 'learning-support'/);
  assert.match(intake, /students\.filter\(s => s\.familyId === familyId\)/);
});

test('synthetic intake neither sends data nor writes any family records', () => {
  assert.doesNotMatch(intake, /\bfetch\s*\(|\bdispatch\s*\(|\bsupabase\b/i);
  assert.doesNotMatch(intake, /\blocalStorage\s*\.|\bsessionStorage\s*\.|generateContent\s*\(/);
  assert.match(intake, /proposeSchoolEmailCandidate\(synthetic, familyId, students\)/);
  assert.match(intake, /fingerprintPastedSchoolEmail\(/);
  assert.match(intake, /rawText: ''/);
});

test('trusted gate remains read-only and cannot execute or persist', () => {
  assert.doesNotMatch(preview, /\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/);
  assert.doesNotMatch(preview, /\bdispatch\s*\(|\benqueue\s*\(|\bsendEmail\s*\(/);
  assert.match(preview, /executed: false/);
});
