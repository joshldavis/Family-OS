-- Demo kitchen: a public, shared household that anonymous visitors can join.
alter table public.households add column if not exists is_demo boolean not null default false;

create or replace function public.join_demo()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select id into hid from public.households where is_demo limit 1;
  if hid is null then raise exception 'no demo kitchen'; end if;
  insert into public.profiles(user_id, display_name) values (uid, 'Guest') on conflict (user_id) do nothing;
  insert into public.household_members(household_id, user_id, role, display_name)
  values (hid, uid, 'member', 'Guest') on conflict do nothing;
  update public.profiles set current_household_id = hid where user_id = uid;
  return hid;
end $$;

-- Guests may not mint invites for the demo kitchen.
drop policy if exists invites_insert on public.household_invites;
create policy invites_insert on public.household_invites for insert
  with check (
    public.is_member(household_id) and created_by = auth.uid()
    and not exists (select 1 from public.households h where h.id = household_id and h.is_demo)
  );
