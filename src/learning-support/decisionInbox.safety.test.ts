import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inbox = readFileSync(new URL('../components/ParentDecisionInbox.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../pages/LearningSupportHome.tsx', import.meta.url), 'utf8');

test('review UI cannot call external APIs, mutate family state or persist decisions', () => {
  assert.doesNotMatch(inbox, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(inbox, /\bfetch\s*\(|\bdispatch\s*\(|\baxios\b|\bsupabase\b/i);
  assert.doesNotMatch(inbox, /generateContent|\bsendEmail\s*\(/);
  assert.match(inbox, /useState<Record<string, DraftReviewDecision>>\(\{\}\)/);
  assert.match(inbox, /does not update Schoolwork/);
});

test('review UI is parent/mode gated and separately feature-flagged', () => {
  assert.match(home, /VITE_FAMILY_DECISION_INBOX === 'true'/);
  assert.match(inbox, /actorRole === Role\.PARENT/);
  assert.match(inbox, /activeMode === 'learning-support'/);
});

test('draft approval remains explicit and undoable', () => {
  assert.match(inbox, /Approve draft only/);
  assert.match(inbox, /Undo/);
  assert.match(inbox, /recordDraftDecision\(/);
});
