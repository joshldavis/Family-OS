-- FOS-SEC-001 — staged household policy lockdown, NOT ACTIVATED
-- This file is a proposal for a coordinated cutover, NOT safe to deploy alone.
--
-- BLOCKING PRECONDITIONS:
-- 1. Identify the actual Family OS database and back it up.
-- 2. Verify current pg_policies/role grants and users against the live schema.
-- 3. Implement, test, and deploy a trusted server-side bootstrap/invite accept
--    flow (including role assignment, expiry and replay protection).
-- 4. Migrate and validate legitimate pre-existing members.
-- 5. Confirm the app's current client-side join/onboarding has been replaced.
--
-- WARNING: Running this SQL BEFORE those steps disables existing client-side
-- family creation, joins, and profile writes. DO NOT execute in production yet.
--
-- No user data is deleted by these statements. Because this changes privileges,
-- a rollback needs equally careful review; restoring permissive policies is NOT
-- considered a safe default.

begin;

alter table public.families enable row level security;
alter table public.profiles enable row level security;

-- Prevent direct untrusted household bootstrap and profile/member injection.
drop policy if exists "anyone can insert a family (during onboarding)"
  on public.families;
drop policy if exists "profiles: insert (onboarding)"
  on public.profiles;

-- The old policies let any household member modify the family row or ANY
-- profile in their family. These include invite_code, role and family_id.
-- Such changes must go through an authenticated, policy-checked server API.
drop policy if exists "family members can update their family"
  on public.families;
drop policy if exists "profiles: update own family"
  on public.profiles;

-- Revoke direct mutation permissions for browser-exposed roles.
-- Grants are necessary in addition to policies; denying only RLS is not enough
-- when other permissive policies could exist on the live database.
revoke insert, update, delete on table public.families
  from public, anon, authenticated;
revoke insert, update, delete on table public.profiles
  from public, anon, authenticated;

-- The legacy membership lookup used an unqualified profiles table and
-- LIMIT 1. After auditing duplicate auth identities, enforce one primary
-- profile per authenticated user in the current app's single-family model.
-- If duplicates exist this fails the cutover rather than selecting an
-- arbitrary household. Review any multi-household requirement separately.
create unique index if not exists profiles_unique_authenticated_identity
  on public.profiles (auth_id) where auth_id is not null;

-- Harden the SECURITY DEFINER lookup: fully-qualified names, no caller-controlled
-- search_path, and no EXECUTE privilege for anonymous clients.
create or replace function public.get_my_family_id()
returns text
language sql
stable
security definer
set search_path = ''
as $membership$
  select p.family_id
  from public.profiles p
  where p.auth_id = (select auth.uid())
  limit 1;
$membership$;
revoke execute on function public.get_my_family_id() from public, anon;
grant execute on function public.get_my_family_id() to authenticated;

-- Keep the existing SELECT policy for authenticated existing members;
-- this migration does NOT create a broad new SELECT policy.
-- Future family/profile changes require a server endpoint that verifies
-- the auth token and precise household capabilities before any service-role write.

commit;
