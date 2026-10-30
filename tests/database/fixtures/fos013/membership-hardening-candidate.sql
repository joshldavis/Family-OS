-- Preserve Made Again's RPC join/create/switch flows. They execute with their
-- function owner's permissions and do not rely on client-wide UPDATE grants.
-- Ordinary clients may edit only their own display_name under the existing RLS.
-- Authorization-bearing membership fields cannot be reassigned through REST.
revoke update, truncate on table public.household_members from public, anon, authenticated;
revoke update (household_id, user_id, role, joined_at)
  on table public.household_members from public, anon, authenticated;
grant update (display_name) on table public.household_members to authenticated;

-- Family OS excludes demo households. Keep that classification trusted without
-- removing Made Again's existing member rename policy or changing its RPCs.
-- A SECURITY DEFINER RPC executes with its owner's current_user (postgres),
-- while ordinary API callers run as authenticated/anon and cannot reclassify.
create function public.guard_household_demo_classification()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated')
    and new.is_demo is distinct from old.is_demo then
    raise exception using errcode = '42501',
      message = 'Household demo classification requires trusted server administration';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_household_demo_classification()
  from public, anon, authenticated;
create trigger guard_household_demo_classification
  before update on public.households
  for each row execute function public.guard_household_demo_classification();
