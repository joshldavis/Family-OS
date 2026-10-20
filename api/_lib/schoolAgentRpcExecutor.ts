/**
 * Review-only service-key transport for the FOS-007 atomic RPC. No HTTP route
 * calls this module. A parent bearer is verified through a separate Auth
 * client and is never installed on the service-role RPC client.
 */
import { createClient } from '@supabase/supabase-js';
import { verifyBearerIdentity, verifiedBearerSessionId,
  type SupabaseAuthVerifier } from './verifiedIdentity.ts';
import type { SchoolAgentExecuteRequest, SchoolAgentExecuteResult } from
  './schoolAgentApprovalTransaction.ts';
import { validateSchoolAgentRpcTarget,
  type SchoolAgentRpcConfiguration } from './schoolAgentRpcTarget.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SchoolAgentRpcArguments {
  p_actor_auth_id: string;
  p_session_id: string;
  p_family_id: string;
  p_proposal_id: string;
  p_expected_revision: string;
  p_approval_id: string;
}

export interface SchoolAgentRpcAdapters {
  auth: SupabaseAuthVerifier;
  call(args: SchoolAgentRpcArguments): Promise<{
    data: unknown; error: { code?: string } | null;
  }>;
}

/** Factory used only on a server after a reviewed cutover. */
export function createSchoolAgentServiceRpcAdapters(
  config: SchoolAgentRpcConfiguration,
): SchoolAgentRpcAdapters {
  const target = validateSchoolAgentRpcTarget(config);
  if (!target.ok) throw new Error(`School Agent RPC unavailable: ${target.reason}`);
  const options = { auth: { persistSession: false, autoRefreshToken: false,
    detectSessionInUrl: false } };
  const authClient = createClient(target.url, config.serviceRoleKey!, options);
  const rpcClient = createClient(target.url, config.serviceRoleKey!, options);
  return {
    auth: { getUser: token => authClient.auth.getUser(token) },
    call: async args => {
      const { data, error } = await rpcClient.rpc(
        'school_agent_execute_reviewed_assignment', args);
      return { data, error };
    },
  };
}

const rejected = (reason: Extract<SchoolAgentExecuteResult, { ok: false }>['reason']):
  SchoolAgentExecuteResult => ({ ok: false, executed: false, reason });

function validResult(value: unknown, familyId: string): SchoolAgentExecuteResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.ok === true && row.executed === true && row.familyId === familyId &&
      typeof row.assignmentId === 'string' && row.assignmentId.length > 0 &&
      typeof row.actionReceiptId === 'string' && uuid.test(row.actionReceiptId)) {
    return { ok: true, executed: true, familyId,
      assignmentId: row.assignmentId, actionReceiptId: row.actionReceiptId };
  }
  if (row.ok === true && row.executed === false &&
      row.reason === 'already_executed' && row.familyId === familyId) {
    return { ok: true, executed: false, reason: 'already_executed', familyId };
  }
  const allowed = new Set([
    'invalid_request','inactive_session','membership_denied','family_erasing','source_not_found',
    'stale_source','consent_denied','unconfirmed_assignment',
    'student_not_verified','approval_denied','duplicate_pending',
  ]);
  if (row.ok === false && row.executed === false &&
      typeof row.reason === 'string' && allowed.has(row.reason)) {
    return rejected(row.reason as Extract<SchoolAgentExecuteResult, { ok: false }>['reason']);
  }
  return null;
}

/** The RPC call is the only database operation; PostgREST owns its transaction. */
export async function executeReviewedAssignmentViaRpc(
  authorization: string | null,
  request: SchoolAgentExecuteRequest,
  adapters: SchoolAgentRpcAdapters,
): Promise<SchoolAgentExecuteResult> {
  const identity = await verifyBearerIdentity(authorization, adapters.auth);
  if (!identity.ok || !uuid.test(identity.authUserId)) return rejected('invalid_identity');
  if (!request || !uuid.test(request.familyId ?? '') ||
      !uuid.test(request.proposalId ?? '') || !uuid.test(request.approvalId ?? '') ||
      !/^[0-9a-f]{64}$/.test(request.expectedRevision ?? '')) {
    return rejected('invalid_request');
  }
  const sessionId = verifiedBearerSessionId(authorization);
  if (!sessionId) return rejected('invalid_identity');

  const args: SchoolAgentRpcArguments = {
    p_actor_auth_id: identity.authUserId,
    p_session_id: sessionId,
    p_family_id: request.familyId,
    p_proposal_id: request.proposalId,
    p_expected_revision: request.expectedRevision,
    p_approval_id: request.approvalId,
  };
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const { data, error } = await adapters.call(args);
      if (!error) return validResult(data, request.familyId) ?? rejected('transaction_failed');
      if (!['40001','40P01','55P03'].includes(error.code ?? '') || attempt === 6) {
        return rejected('transaction_failed');
      }
    } catch {
      // A network failure may follow a commit. A later user retry is safe
      // because the database claim key prevents a duplicate assignment.
      return rejected('transaction_failed');
    }
    await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1) ** 2));
  }
  return rejected('transaction_failed');
}
