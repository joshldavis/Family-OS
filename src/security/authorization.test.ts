import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeHouseholdOperation,
} from './authorization.ts';
import type {
  AuthorizationRequest,
  VerifiedHouseholdMember,
} from './authorization.ts';

const familyA: VerifiedHouseholdMember = {
  authUserId: 'auth-parent-A',
  familyId: 'family-A',
  role: 'parent',
  status: 'active',
  permittedChildIds: ['child-A'],
};
const request: AuthorizationRequest = {
  authUserId: 'auth-parent-A',
  resourceFamilyId: 'family-A',
  capability: 'tasks.write',
};

test('unverified identity cannot act, even with a member object', () => {
  assert.equal(authorizeHouseholdOperation(familyA, { ...request, authUserId: null }).allow, false);
  assert.equal(authorizeHouseholdOperation(null, request).allow, false);
  assert.equal(authorizeHouseholdOperation(familyA, { ...request, authUserId: 'other-user' }).reason, 'identity_mismatch');
});

test('member of family A cannot access family B', () => {
  const decision = authorizeHouseholdOperation(familyA, { ...request, resourceFamilyId: 'family-B' });
  assert.deepEqual(decision, { allow: false, reason: 'different_household' });
});

test('suspended/revoked/invited members cannot perform household actions', () => {
  for (const status of ['invited', 'suspended', 'revoked'] as const) {
    const result = authorizeHouseholdOperation({ ...familyA, status }, request);
    assert.equal(result.reason, 'inactive_membership');
  }
});

test('regular parent cannot grant or manage membership', () => {
  const result = authorizeHouseholdOperation(familyA, { ...request, capability: 'membership.manage' });
  assert.deepEqual(result, { allow: false, reason: 'insufficient_role' });
});

test('verified owner can manage membership in own family', () => {
  const result = authorizeHouseholdOperation({ ...familyA, role: 'owner' }, { ...request, capability: 'membership.manage' });
  assert.equal(result.allow, true);
});

test('caregiver and child cannot write school support data just by being household members', () => {
  for (const role of ['caregiver', 'child'] as const) {
    const result = authorizeHouseholdOperation(
      { ...familyA, role },
      { ...request, capability: 'support.write', childId: 'child-A' },
    );
    assert.equal(result.allow, false);
  }
});

test('even a parent must have an explicit child-level scope for support or school actions', () => {
  for (const capability of ['school.read', 'school.write', 'support.read', 'support.write'] as const) {
    assert.equal(authorizeHouseholdOperation(familyA, { ...request, capability }).reason, 'child_scope_required');
    assert.equal(authorizeHouseholdOperation(familyA, {
      ...request, capability, childId: 'child-B',
    }).reason, 'child_scope_required');
    assert.equal(authorizeHouseholdOperation(familyA, {
      ...request, capability, childId: 'child-A',
    }).allow, true);
  }
});

test('external sends remain blocked without a verified human approval receipt', () => {
  const blocked = authorizeHouseholdOperation(familyA, {
    ...request, capability: 'external.send',
  });
  assert.equal(blocked.reason, 'human_approval_required');
  const approved = authorizeHouseholdOperation(familyA, {
    ...request, capability: 'external.send', humanApprovalVerified: true,
  });
  assert.equal(approved.allow, true);
});

test('default policy rejects unknown capability values at runtime', () => {
  const result = authorizeHouseholdOperation(familyA, {
    ...request, capability: 'admin.root' as AuthorizationRequest['capability'],
  });
  assert.equal(result.reason, 'insufficient_role');
});

test('child and caregiver have no default access to household tasks or school content', () => {
  for (const role of ['child', 'caregiver'] as const) {
    const result = authorizeHouseholdOperation({ ...familyA, role }, {
      ...request, capability: 'tasks.read',
    });
    assert.equal(result.allow, false);
  }
});

test('missing child-scope data fails closed', () => {
  const result = authorizeHouseholdOperation({
    ...familyA,
    permittedChildIds: undefined as unknown as readonly string[],
  }, { ...request, capability: 'support.read', childId: 'child-A' });
  assert.deepEqual(result, { allow: false, reason: 'child_scope_required' });
});
