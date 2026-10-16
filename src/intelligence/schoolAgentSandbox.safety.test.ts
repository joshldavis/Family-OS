import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const intake = readFileSync(new URL('../components/SchoolAgentIntakeSandbox.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/LearningSupportHome.tsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../../api/_lib/schoolAgentApprovalPreview.ts', import.meta.url), 'utf8');
const review = readFileSync(new URL('../components/SyntheticReviewPanel.tsx', import.meta.url), 'utf8');

test('School Agent intake is a separate opt-in and never runs for children or other modes', () => {
  assert.match(page, /VITE_FAMILY_SCHOOL_AGENT_SANDBOX === 'true'/);
  assert.match(intake, /state\.currentUser\?\.role === Role\.PARENT/);
  assert.match(intake, /activeMode === 'learning-support'/);
  assert.doesNotMatch(intake, /state\.students\b/);
  assert.match(intake, /name: 'Demo student A'/);
  assert.match(intake, /name: 'Demo student B'/);
});

test('synthetic intake neither sends data nor writes any family records', () => {
  assert.doesNotMatch(intake, /\bfetch\s*\(|\bdispatch\s*\(|\bsupabase\b/i);
  assert.doesNotMatch(intake, /\blocalStorage\s*\.|\bsessionStorage\s*\.|generateContent\s*\(/);
  assert.match(intake, /proposeSchoolEmailCandidate\(synthetic, familyId, students\)/);
  assert.match(intake, /fingerprintPastedSchoolEmail\(/);
  assert.match(intake, /rawText: ''/);
});

test('trusted gate remains read-only and cannot execute or persist', () => {
  assert.doesNotMatch(preview, /\b(?:supabase|db|repository|table)\s*\.\s*(?:insert|upsert|update|delete)\s*\(/);
  assert.doesNotMatch(preview, /\bdispatch\s*\(|\benqueue\s*\(|\bsendEmail\s*\(/);
  assert.match(preview, /executed: false/);
});

test('synthetic review choices do not dispatch tasks, call providers or persist records', () => {
  assert.doesNotMatch(review, /\bfetch\s*\(|\bdispatch\s*\(|\bsupabase\b|generateContent\s*\(/i);
  assert.doesNotMatch(review, /\b(?:localStorage|sessionStorage)\s*\./);
  assert.match(review, /Approve fictional draft only/);
  assert.match(review, /NO SCHOOLWORK RECORD CREATED/);
  assert.match(review, /onUndoReceipt/);
  assert.match(intake, /<SyntheticReviewPanel/);
});
