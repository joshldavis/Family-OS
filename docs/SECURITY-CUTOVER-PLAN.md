# FOS-SEC-001 — Secure household membership cutover

**Status:** draft proposal, not deployed. **Target database:** shared made-again project, incompatible with current `public.profiles` design. **Owner project:** Family OS. Updated: 2026-10-16.

## Why this is the gating item

The current checked-in `src/lib/schema.sql` explicitly allows anonymous/family-unverified family and profile inserts, and allows a member to update another member's profile by `family_id`. `get_my_family_id()` then trusts this profile membership as the basis for every other core-table policy. An attacker able to insert or modify `profiles.family_id` could gain access to unrelated family records if the same policies exist in a live database. This is a **source-inspection risk**; no production breach or live policy exposure is being claimed.

The same checked-in tenant lookup is a public-schema `SECURITY DEFINER` function with an implicit search path and a `LIMIT 1` on `auth_id`; the draft cutover therefore hardens its search path, removes anonymous execution, and requires unique authenticated profile identity **after a duplicate-membership preflight**. Validate that existing family memberships remain correct before indexing.\n\nThere is also a product correctness issue: `Auth.tsx` uses an untrusted client-side invite code lookup and creates a Parent profile, while `pushFamilyData()` initially upserts profiles without `auth_id`; newly registered users may be unable to create or see legitimate records under an otherwise restrictive RLS policy.

**Do not run** `supabase/proposals/fos_sec_001_household_lockdown.sql` until the replacement membership workflow is deployed and verified. The proposal intentionally cuts off direct family/profile writes and would disable old client-side onboarding and joins.

## Live-environment status

- Vercel project `family-os` was found, ID `prj_ySBHcLFiQ68sJOMZ29FYXN6UQMoD`.
- Vercel reports `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` configured for production/preview; values were not retrieved.
- **Preview/production credential isolation:** the same Vercel environment-variable entries are targeted to both `preview` and `production`. Before merging agent/backend features, verify preview deployments cannot use a production database service-role key; configure separate non-production Supabase credentials for preview, restrict deployment trust, and rotate credentials if their exposure is suspected. No secret values were inspected.
- The visible Vercel environment list does **not** include `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` used by `src/lib/supabase.ts`. A built bundle may use different configuration or localStorage/offline fallback. Verify deployed browser behavior before drawing conclusions.
- The owner confirmed made-again is intentionally shared with Family OS to avoid a second paid project. Only an authorized catalog-only audit was run; no family rows or credentials were read.
- No production data migration or permission change has been made.

### Confirmed shared-project collision

The made-again catalog already has `public.profiles` with `user_id uuid`,
`display_name`, and `current_household_id uuid`; it lacks Family OS's
`id text`, `auth_id uuid`, `family_id text`, and `role text` columns. This
proposal must not be applied to that shared project. Its first transaction
step now rejects the mismatch before altering policies or grants. A dedicated
Family OS namespace and server/data-access cutover require separate design
and isolated verification.

## Replacement trust model

### Bootstrap (new household)
1. A user registers through Supabase Auth and proves email ownership using the configured Auth confirmation method. No family membership is inferred from client-provided email, role, or family ID.
2. The client sends an authenticated request to a **trusted server endpoint**. The server verifies the bearer token by calling `supabase.auth.getUser(token)`; never trust a user ID sent in JSON.
3. The server atomically inserts family + first verified adult membership. The server alone selects roles and membership records. Idempotency protects against retries, and a rollback protects against partial family/profile creation.
4. A client can read only the resulting permitted household records. Account creation without a verified auth identity cannot create a household in the live database.

### Invite another adult
1. A currently authenticated, authorized adult requests an invitation. Server checks membership and invite-management capability. Merely having `role='Parent'` is not automatically household admin unless explicitly authorized.
2. Generate a cryptographically random invitation secret (at least 128 bits), store only its hash, assign recipient role/scopes and short expiration. Rate-limit creation and redemption, support revocation, record who invited whom.
3. The invited user verifies their identity. The trusted endpoint validates unexpired, unredeemed, matching invitation under a transaction lock and creates membership for the server-verified auth user. The invitation becomes redeemed atomically.
4. Never expose existing `families.invite_code` through a public lookup API. Plan rotation/sunset of legacy shared codes before external pilot.

### Role boundaries
- `family_id`, `auth_id`, membership role and authorization scopes are **server-owned fields**.
- Parent/guardian vs admin capabilities must be separate and explicit.
- Child and caregiver roles cannot read restricted educational/health/behavioral records just because they are household members. Sensitive child-level scopes require additional authorization.
- Existing `Student` IDs and child `profile` IDs are not automatically merged by name.

## Safe cutover sequence

**P0 — Confirm and back up:** identify the real Supabase ref by the authorized project owner; take a verified backup/snapshot and rehearse restore; run read-only audit `supabase/audits/family_os_readonly_baseline.sql` (in draft PR #2); verify deployed browser env and current RLS permissions. Inventory all auth-linked profiles, null `auth_id` rows, duplicate family memberships and existing invite codes **without exporting PII to a public repository**.

**P1 — Build secure server flows:** implement verified signup, family bootstrap and invite issue/accept/revoke backed by an atomic DB operation. Review invitation role semantics with existing family workflows. Place service-role key only in server runtime. Add concurrency/rate-limit/expiration and comprehensive integration tests in isolated Supabase.

**P2 — Migration rehearsal:** in a disposable database copied from non-sensitive schema + synthetic fixtures, migrate valid existing memberships and test the SQL proposal under rollback/restore. Test the new flows with multi-family and multiple-child fixtures, including old accounts. Update frontend to call secure endpoints; preserve offline/demo behavior as a distinct store.

**P3 — Coordinated release:** deploy server endpoints and frontend with feature flags OFF. Run data-access smoke tests and health checks. Apply the reviewed lockdown migration during a controlled release window, then enable new verified onboarding. Audit PostgreSQL grants, `pg_policies`, and direct Data API attempts. Do not activate agents while this is incomplete.

**P4 — Follow-up:** after secure tenant isolation passes, validate the Family Intelligence foundation migration, build the server-side action/approval gateway, and begin source-linked school workflow behind a separate flag.

## Tests required before marking FOS-SEC-001 closed

- Anonymous client cannot create families/profiles or enumerate invitations.
- Authenticated member of family A cannot create/join/update membership in family B.
- A family member cannot alter another member's role/family ID or change family invite code via direct client APIs.
- User cannot make themselves an admin by editing claims or `user_metadata`.
- Expired/revoked/redeemed invitations are rejected, including concurrent redemption.
- Existing legitimate family members can still sign in; child accounts never gain parent scopes.
- Failed signups or interrupted transactions do not leave orphaned family/profile rows.
- A new household bootstrap succeeds once and remains idempotent on retries.
- Unauthorized service API request cannot bypass backend membership checks; RLS is separately tested against direct Data API calls.
- Family A's unrelated tasks/assignments/documents are never visible to B even after a membership migration.
- Browser local/demo mode stays functional without forwarding demo `fam-1` IDs to server as real tenant IDs.

## Current review artifacts

- `supabase/proposals/fos_sec_001_household_lockdown.sql`: proposed **not-to-deploy-yet** grant/RLS lockdown.
- `supabase/proposals/fos_sec_001_verify.sql`: read-only checks to run after rehearsing the policy cutover on a disposable database.
- [FOS-SEC-001 issue](https://github.com/joshldavis/Family-OS/issues/3).
- [Family Intelligence foundation PR](https://github.com/joshldavis/Family-OS/pull/2) (separate feature branch).
- [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Rollback

Rollback is **not** blindly restoring `WITH CHECK(true)`. Roll back application access to a safe read-only/maintenance mode, restore last known-good database snapshot in a controlled environment, and reintroduce only the minimum grants/policies required for a trusted verified join flow. Keep an incident log if any member can no longer access their own family.
