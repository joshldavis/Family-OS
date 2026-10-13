/**
 * Family Intelligence Layer contracts — additive, currently NOT wired into
 * existing modules. Corresponds to the draft 2026-10-13 SQL migration.
 *
 * Never treat model confidence as authorization for an action.
 * Never merge student + profile identities based on display name.
 */
export type IntelligenceSensitivity = 'normal' | 'sensitive' | 'restricted';

export type FamilyEntityKind =
  | 'person' | 'task' | 'event' | 'document' | 'routine' | 'routine_run'
  | 'observation' | 'meal' | 'shopping_item' | 'expense' | 'goal' | 'other';

export type FamilySourceKind =
  | 'manual' | 'email' | 'document' | 'calendar' | 'school_portal'
  | 'integration' | 'agent' | 'import' | 'system';

export type IntelligenceActorKind = 'human' | 'agent' | 'system' | 'integration';

export type ObservationKind =
  | 'friction' | 'routine_outcome' | 'preference_signal'
  | 'support_strategy' | 'workload_signal' | 'meal_feedback' | 'other';

export type ProposalStatus =
  | 'draft' | 'awaiting_approval' | 'approved' | 'rejected'
  | 'executing' | 'executed' | 'failed' | 'cancelled';

export type ProposalRiskClass = 'low' | 'needs_review' | 'high' | 'restricted';

export interface FamilyEntity {
  id: string; // UUID
  familyId: string;
  kind: FamilyEntityKind;
  label: string | null;
  /** Bridge to existing tables: for example legacyModule='schoolwork', legacyId='asg-…'. */
  legacyModule: string | null;
  legacyId: string | null;
  sensitivityClass: IntelligenceSensitivity;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FamilySource {
  id: string;
  familyId: string;
  originKind: FamilySourceKind;
  sourceSystem: string;
  externalRef: string | null;
  label: string | null;
  contentHash: string | null;
  occurredAt: string | null;
  capturedAt: string;
}

export interface FamilyEntityLink {
  id: string;
  familyId: string;
  fromEntityId: string;
  toEntityId: string;
  relationship: string;
  sourceId: string | null;
  /** Inference confidence 0..1; null if not an inference. */
  confidence: number | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface FamilyActivityEvent {
  id: string;
  familyId: string;
  subjectEntityId: string | null;
  sourceId: string | null;
  eventKind: string;
  actorKind: IntelligenceActorKind;
  actorRef: string | null;
  occurredAt: string;
  recordedAt: string;
  /** Stable across retries for exactly-once intended effects. */
  idempotencyKey: string | null;
  sensitivityClass: IntelligenceSensitivity;
  payload: Record<string, unknown>;
}

export interface FamilyObservation {
  id: string;
  familyId: string;
  subjectEntityId: string | null;
  eventId: string | null;
  sourceId: string | null;
  observationKind: ObservationKind;
  reportedByKind: Extract<IntelligenceActorKind, 'human' | 'agent' | 'integration'>;
  summary: string;
  context: Record<string, unknown>;
  intensity: number | null; // 0..5
  confidence: number | null; // 0..1, for inferred observations
  sensitivityClass: IntelligenceSensitivity;
  observedAt: string;
  recordedAt: string;
}

export interface FamilyActionProposal {
  id: string;
  familyId: string;
  targetEntityId: string | null;
  sourceId: string | null;
  actionKind: string;
  proposalPayload: Record<string, unknown>;
  rationale: string | null;
  createdByKind: Extract<IntelligenceActorKind, 'human' | 'agent' | 'system'>;
  createdByRef: string | null;
  confidence: number | null;
  riskClass: ProposalRiskClass;
  status: ProposalStatus;
  approvedByRef: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request from an agent to a trusted tool, not a direct database mutation. */
export interface AgentActionIntent {
  familyId: string;
  requestedByAgent: string;
  actionKind: string;
  targetEntityId?: string;
  sourceId?: string;
  proposedPayload: Record<string, unknown>;
  evidenceEventIds: string[];
  rationale: string;
  confidence?: number;
  idempotencyKey: string;
}

/**
 * Outcome is server-owned; never fabricate approvals in a browser or model reply.
 */
export interface AgentActionDecision {
  proposalId: string;
  outcome: 'requires_approval' | 'rejected' | 'approved_for_execution';
  reviewedByRef?: string;
  reason?: string;
}
