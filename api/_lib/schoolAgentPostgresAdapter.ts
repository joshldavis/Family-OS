/**
 * Review-only PostgreSQL adapter for the School Agent approval contract.
 * No route constructs this adapter. Supply a server-only Pool whose database
 * role has the reviewed grants; never expose its connection string to Vite.
 */
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { parseBearerToken, type SupabaseAuthVerifier } from './verifiedIdentity.ts';
import type {
  SchoolAgentActionClaim, SchoolAgentApprovalAdapters, SchoolAgentExecutionTx,
  TrustedLockedReview, TrustedLockedSource,
} from './schoolAgentApprovalTransaction.ts';
import type { TrustedHouseholdMembership, TrustedSchoolProposal } from './schoolAgentApprovalPreview.ts';

type Row = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exactSessionId(header: string): string | null {
  const token = parseBearerToken(header);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Row;
    return typeof payload.session_id === 'string' && uuid.test(payload.session_id)
      ? payload.session_id : null;
  } catch { return null; }
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid database timestamp');
  return date.toISOString();
}

function first(result: { rows: Row[] }): Row | null {
  return result.rows[0] ?? null;
}

function databaseTx(client: PoolClient): SchoolAgentExecutionTx {
  let claimedId: string | null = null;
  return {
    activeSession: async (authUserId, header) => {
      const sessionId = exactSessionId(header);
      if (!sessionId || !uuid.test(authUserId)) return false;
      const row = first(await client.query(
        'select family_os.school_agent_session_active($1::uuid,$2::uuid) as active',
        [authUserId, sessionId],
      ));
      return row?.active === true;
    },
    lockMembership: async (authUserId, familyId): Promise<TrustedHouseholdMembership | null> => {
      const row = first(await client.query(`
        select m.household_id::text as family_id, m.user_id::text as auth_user_id
        from public.household_members m
        join public.profiles p on p.user_id = m.user_id
        join public.households h on h.id = m.household_id
        where m.household_id = $1::uuid and m.user_id = $2::uuid
          and m.role = 'owner' and p.current_household_id = m.household_id
          and not h.is_demo
        for share of m, p, h`, [familyId, authUserId]));
      return row ? { familyId: String(row.family_id),
        authUserId: String(row.auth_user_id), role: 'parent', status: 'active' } : null;
    },
    lockProposal: async (familyId, proposalId): Promise<TrustedSchoolProposal | null> => {
      const row = first(await client.query(`
        select p.id::text, p.family_id::text, p.source_ref_digest,
          p.source_revision, p.title, p.student_id, p.due_date::text,
          p.status, p.consent_captured_at,
          p.title_confirmed_by_parent, p.student_confirmed_by_parent,
          p.date_confirmed_by_parent, s.source_system,
          c.status as consent_status
        from family_os.family_action_proposals p
        join family_os.family_sources s
          on s.family_id = p.family_id and s.id = p.source_id
        join family_os.school_agent_source_consents c
          on c.family_id = s.family_id and c.source_id = s.id
        where p.family_id = $1::uuid and p.id = $2::uuid
        for update of p
        for share of s, c`, [familyId, proposalId]));
      if (!row) return null;
      if (row.source_system !== 'school_email') return null;
      return {
        id: String(row.id), familyId: String(row.family_id),
        sourceSystem: 'school_email',
        sourceRefDigest: String(row.source_ref_digest),
        kind: 'assignment', title: String(row.title),
        date: String(row.due_date), studentId: String(row.student_id),
        reviewStatus: row.status === 'approved' || row.status === 'executed' ?
          'ready_for_review' : 'needs_correction',
        consentCapturedAt: iso(row.consent_captured_at),
        consentStatus: row.consent_status === 'active' ? 'active' :
          row.consent_status === 'revoked' ? 'revoked' : 'pending',
        titleConfirmedByParent: row.title_confirmed_by_parent === true,
        studentConfirmedByParent: row.student_confirmed_by_parent === true,
        dateConfirmedByParent: row.date_confirmed_by_parent === true,
        revision: String(row.source_revision),
      };
    },
    lockSourceAndConsent: async (familyId, proposalId): Promise<TrustedLockedSource | null> => {
      const row = first(await client.query(`
        select s.family_id::text, s.id::text as source_id, s.source_ref_digest,
          c.status, c.granted_at
        from family_os.family_action_proposals p
        join family_os.family_sources s
          on s.family_id = p.family_id and s.id = p.source_id
        join family_os.school_agent_source_consents c
          on c.family_id = s.family_id and c.source_id = s.id
        where p.family_id = $1::uuid and p.id = $2::uuid
        for share of p, s, c`, [familyId, proposalId]));
      return row ? {
        familyId: String(row.family_id), sourceId: String(row.source_id),
        sourceRefDigest: String(row.source_ref_digest),
        consentStatus: row.status === 'active' ? 'active' :
          row.status === 'revoked' ? 'revoked' : 'pending',
        consentGrantedAt: iso(row.granted_at),
      } : null;
    },
    lockReview: async (familyId, receiptId): Promise<TrustedLockedReview | null> => {
      const row = first(await client.query(`
        select id::text, family_id::text, proposal_id::text, source_id::text,
          source_revision, decision, reviewed_by_auth_id::text,
          confirmed_title, confirmed_student_id, confirmed_due_date::text
        from family_os.school_agent_review_receipts
        where family_id = $1::uuid and id = $2::uuid
        for share`, [familyId, receiptId]));
      return row ? {
        id: String(row.id), familyId: String(row.family_id),
        proposalId: String(row.proposal_id), sourceId: String(row.source_id),
        sourceRevision: String(row.source_revision),
        decision: row.decision as TrustedLockedReview['decision'],
        reviewedByAuthUserId: String(row.reviewed_by_auth_id),
        confirmedTitle: row.confirmed_title == null ? null : String(row.confirmed_title),
        confirmedStudentId: row.confirmed_student_id == null ? null : String(row.confirmed_student_id),
        confirmedDueDate: row.confirmed_due_date == null ? null : String(row.confirmed_due_date),
      } : null;
    },
    studentBelongsToFamily: async (familyId, studentId) => {
      const row = first(await client.query(`
        select 1 from family_os.students where family_id = $1::uuid and id = $2
        for share`, [familyId, studentId]));
      return Boolean(row);
    },
    claimUniqueAction: async (claim: SchoolAgentActionClaim) => {
      const inserted = first(await client.query(`
        insert into family_os.school_agent_action_claims
          (family_id,source_id,proposal_id,approved_receipt_id,action_kind,idempotency_digest)
        select $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6
        from family_os.family_action_proposals p
        where p.family_id=$1::uuid and p.id=$3::uuid and p.status='approved'
        on conflict (family_id,source_id,action_kind) do nothing
        returning id::text`, [claim.familyId, claim.sourceId, claim.proposalId,
          claim.approvalId, claim.kind, claim.idempotencyDigest]));
      if (inserted) { claimedId = String(inserted.id); return 'claimed'; }
      const existing = first(await client.query(`
        select c.status, r.id as receipt_id
        from family_os.school_agent_action_claims c
        left join family_os.school_agent_execution_receipts r
          on r.family_id = c.family_id and r.claim_id = c.id
        where c.family_id = $1::uuid and c.source_id = $2::uuid and c.action_kind = $3
        for update of c`, [claim.familyId, claim.sourceId, claim.kind]));
      return existing?.status === 'executed' && existing.receipt_id ?
        'already_executed' : 'conflict';
    },
    createAssignment: async fields => {
      const id = 'school:' + randomUUID();
      const row = first(await client.query(`
        insert into family_os.assignments
          (id,family_id,student_id,title,due_date,source)
        values ($1,$2::uuid,$3,$4,$5::date,'AI')
        returning id, family_id::text, student_id`,
        [id, fields.familyId, fields.studentId, fields.title, fields.dueDate]));
      if (!row) throw new Error('Assignment insert returned no row');
      return { id: String(row.id), familyId: String(row.family_id),
        studentId: String(row.student_id) };
    },
    finalizeAction: async fields => {
      if (!claimedId) throw new Error('No claim in this transaction');
      const claim = first(await client.query(`
        update family_os.school_agent_action_claims
        set status='executed', assignment_id=$1,
          executed_by_auth_id=$2::uuid, executed_at=now()
        where id=$3::uuid and family_id=$4::uuid and source_id=$5::uuid
          and proposal_id=$6::uuid and approved_receipt_id=$7::uuid
          and status='claimed'
        returning id`, [fields.assignmentId, fields.actorAuthUserId, claimedId,
          fields.familyId, fields.sourceId, fields.proposalId, fields.approvalId]));
      if (!claim) throw new Error('Claim finalization failed');
      const receipt = first(await client.query(`
        insert into family_os.school_agent_execution_receipts
          (family_id,claim_id,assignment_id,source_revision,actor_auth_user_id)
        values ($1::uuid,$2::uuid,$3,$4,$5::uuid)
        returning id::text`, [fields.familyId, claimedId, fields.assignmentId,
          fields.sourceRevision, fields.actorAuthUserId]));
      const proposal = first(await client.query(`
        update family_os.family_action_proposals set status='executed'
        where family_id=$1::uuid and id=$2::uuid and status='approved'
        returning id`, [fields.familyId, fields.proposalId]));
      if (!receipt || !proposal) throw new Error('Execution receipt or proposal update failed');
      return { actionReceiptId: String(receipt.id) };
    },
  };
}

function retryable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' &&
    'code' in error && (error.code === '40001' || error.code === '40P01' ||
      error.code === '55P03'));
}

export function createSchoolAgentPostgresAdapters(
  auth: SupabaseAuthVerifier, pool: Pick<Pool, 'connect'>,
  reportSqlState?: (code: string) => void,
): SchoolAgentApprovalAdapters {
  return {
    auth,
    runSerializable: async callback => {
      for (let attempt = 0; attempt < 7; attempt++) {
        const client = await pool.connect();
        let discard = false;
        try {
          await client.query('begin isolation level serializable');
          await client.query("set local statement_timeout = '5s'");
          await client.query("set local lock_timeout = '2s'");
          const result = await callback(databaseTx(client));
          await client.query('commit');
          return result;
        } catch (error) {
          try {
            reportSqlState?.(error && typeof error === 'object' &&
              'code' in error && typeof error.code === 'string' ? error.code : 'non_sql');
          } catch { /* diagnostics cannot alter rollback */ }
          try { await client.query('rollback'); } catch { discard = true; }
          if (!retryable(error) || attempt === 6) throw error;
        } finally {
          client.release(discard);
        }
        await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1) ** 2));
      }
      throw new Error('Serializable retry limit exceeded');
    },
  };
}
