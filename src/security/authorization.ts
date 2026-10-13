/**
 * FOS-SEC-001: a pure, conservative authorization policy for a future trusted
 * server gateway. NOT YET USED by the live app or database.
 *
 * The server must first verify the session with Supabase Auth and obtain
 * membership and child scopes from trusted database tables.
 * Browser-supplied roles/scopes MUST NEVER be passed as authoritative input.
 */
export type HouseholdMemberRole = 'owner' | 'parent' | 'caregiver' | 'child';

export type HouseholdCapability =
  | 'household.read'
  | 'tasks.read'
  | 'tasks.write'
  | 'school.read'
  | 'school.write'
  | 'support.read'
  | 'support.write'
  | 'membership.invite'
  | 'membership.manage'
  | 'external.send';

export interface VerifiedHouseholdMember {
  /** Verified Supabase Auth user id from getUser(token); not client input. */
  authUserId: string;
  familyId: string;
  role: HouseholdMemberRole;
  status: 'active' | 'invited' | 'suspended' | 'revoked';
  /** Child permissions must be assigned by an authorized family administrator. */
  permittedChildIds: readonly string[];
}

export interface AuthorizationRequest {
  /** Auth identity from the independently verified session. */
  authUserId: string | null;
  /** Target family resolved from the actual database record, not only URL/body. */
  resourceFamilyId: string;
  capability: HouseholdCapability;
  /** Mandatory for child-specific protected information. */
  childId?: string;
  /** A server-verified approval receipt, not a model's confidence. */
  humanApprovalVerified?: boolean;
}

export interface AuthorizationDecision {
  allow: boolean;
  reason: string;
}

const BASE_PERMISSIONS: Readonly<Record<HouseholdMemberRole, ReadonlySet<HouseholdCapability>>> = {
  owner: new Set([
    'household.read', 'tasks.read', 'tasks.write',
    'school.read', 'school.write', 'support.read', 'support.write',
    'membership.invite', 'membership.manage', 'external.send',
  ]),
  parent: new Set([
    'household.read', 'tasks.read', 'tasks.write',
    'school.read', 'school.write', 'support.read', 'support.write',
    'external.send',
  ]),
  caregiver: new Set(['household.read', 'tasks.read', 'school.read']),
  child: new Set(['tasks.read']),
};

/** Child-sensitive capabilities always require a verified scope. */
const CHILD_SCOPED = new Set<HouseholdCapability>([
  'school.read', 'school.write', 'support.read', 'support.write',
]);

/**
 * Decide whether a trusted server *may* perform an authorized operation.
 *
 * This decision does not execute a write and is not sufficient for DB access:
 * RLS and per-resource checks must still be applied at the data gateway.
 */
export function authorizeHouseholdOperation(
  member: VerifiedHouseholdMember | null,
  request: AuthorizationRequest,
): AuthorizationDecision {
  if (!request.authUserId || !member) {
    return { allow: false, reason: 'verified_member_required' };
  }
  if (request.authUserId !== member.authUserId) {
    return { allow: false, reason: 'identity_mismatch' };
  }
  if (member.status !== 'active') {
    return { allow: false, reason: 'inactive_membership' };
  }
  if (!request.resourceFamilyId || member.familyId !== request.resourceFamilyId) {
    return { allow: false, reason: 'different_household' };
  }
  if (!BASE_PERMISSIONS[member.role]?.has(request.capability)) {
    return { allow: false, reason: 'insufficient_role' };
  }
  if (CHILD_SCOPED.has(request.capability)) {
    if (!request.childId || !member.permittedChildIds.includes(request.childId)) {
      return { allow: false, reason: 'child_scope_required' };
    }
  }
  if (request.capability === 'external.send' && !request.humanApprovalVerified) {
    return { allow: false, reason: 'human_approval_required' };
  }

  return { allow: true, reason: 'authorized' };
}
