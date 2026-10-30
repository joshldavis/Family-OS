-- Shared made-again workspace. Existing membership hardening is a prerequisite.
-- Prerequisite: public.household_members authorization fields are immutable
-- to ordinary self-updates. Do not run the legacy src/lib/schema.sql.
-- Existing Auth identities/households/recipes are neither recreated nor copied.
-- Verified shared-project roles: owner => Parent; member => Member. Child is
-- reserved for explicit app-local child profiles, which have no Auth account.

create schema family_os;
revoke all on schema family_os from public, anon, authenticated;
grant usage on schema family_os to authenticated, service_role;

-- Invoker permissions and public-table RLS apply to every lookup. An arbitrary
-- current_household_id alone does not authorize access: self membership is required.
create function family_os.current_family_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select p.current_household_id
  from public.profiles p
  join public.household_members m
    on m.household_id = p.current_household_id and m.user_id = p.user_id
  join public.households h on h.id = m.household_id
  where p.user_id = (select auth.uid()) and m.role in ('owner', 'member')
    and not h.is_demo
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
$$;
revoke all on function family_os.current_family_id() from public, anon;
grant execute on function family_os.current_family_id() to authenticated, service_role;

-- Parent administration and financial access derive from the verified owner
-- role. An ordinary household member is never inferred to be a parent/child.
create function family_os.current_owner_family_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select m.household_id
  from public.household_members m
  where m.household_id = (select family_os.current_family_id())
    and m.user_id = (select auth.uid()) and m.role = 'owner'
$$;
revoke all on function family_os.current_owner_family_id() from public, anon;
grant execute on function family_os.current_owner_family_id() to authenticated, service_role;

-- Children are local household profiles, never Auth users. The fixed prefix
-- prevents an editable child profile from presenting an adult account ID.
create table family_os.child_profiles (
  id text primary key default ('child:' || gen_random_uuid()::text),
  family_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  avatar_url text,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_profiles_child_id check (id like 'child:%' and length(id) > 6),
  unique (family_id, id)
);

create view family_os.families with (security_invoker = true) as
select h.id, h.name, null::text as invite_code, h.created_at
from public.households h
where h.id = (select family_os.current_family_id());

-- Exactly one account row for .eq('auth_id', authId).single(): only the
-- verified active household is represented, even for multi-household accounts.
-- No auth.users email/metadata is exposed; member names use existing membership data.
create view family_os.profiles with (security_invoker = true) as
select m.user_id::text as id, m.user_id as auth_id, m.household_id as family_id,
       coalesce(m.display_name, 'Member') as name,
       case when m.user_id = (select auth.uid()) then coalesce((select auth.jwt()) ->> 'email', '') else '' end as email,
       case m.role when 'owner' then 'Parent' else 'Member' end as role,
       null::text as avatar_url, 0::integer as points,
       m.joined_at as created_at
from public.household_members m
where m.household_id = (select family_os.current_family_id())
  and m.role in ('owner', 'member')
union all
select c.id, null::uuid as auth_id, c.family_id, c.name, null::text as email,
       'Child'::text as role, c.avatar_url, c.points, c.created_at
from family_os.child_profiles c
where c.family_id = (select family_os.current_family_id());

-- Shared identity adapters are read-only even when views could be updatable.
revoke all on family_os.families, family_os.profiles from public, anon, authenticated;
grant select on family_os.families, family_os.profiles to authenticated, service_role;

create table family_os.students (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  child_profile_id text,
  name text not null check (length(btrim(name)) > 0),
  grade text,
  notes text,
  avatar_url text,
  student_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references family_os.child_profiles(family_id, id) on delete restrict
);

create table family_os.assignments (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  student_id text not null,
  title text not null check (length(btrim(title)) > 0),
  subject text not null default '',
  due_date date not null,
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Done')),
  estimated_minutes integer check (estimated_minutes >= 0),
  source text check (source in ('Manual', 'Import', 'AI')),
  teacher text,
  link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by_id uuid references auth.users(id) on delete set null,
  foreign key (family_id, student_id)
    references family_os.students(family_id, id) on delete cascade
);

create table family_os.chores (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  assignee_id text,
  title text not null check (length(btrim(title)) > 0),
  due_date date not null,
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Done')),
  points integer not null default 0 check (points >= 0),
  recurrence text check (recurrence in ('Daily', 'Weekly', 'Biweekly', 'Monthly', 'One-time')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by_id uuid references auth.users(id) on delete set null
);

create table family_os.events (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  -- Preserve datetime-local wall time from the existing UI. A later connector
  -- must define family timezone semantics before migrating to timestamptz.
  start_time text not null,
  end_time text,
  location text,
  provider text not null default 'internal' check (provider in ('internal', 'google')),
  google_event_id text,
  attendee_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_os.transactions (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  description text not null,
  amount numeric not null,
  category text,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  source text check (source in ('manual', 'import', 'ai_scan')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_os.budgets (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  limit_amount numeric not null,
  spent numeric not null default 0,
  period text not null default 'monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_os.savings_goals (
  id text primary key,
  family_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target numeric not null,
  current numeric not null default 0,
  deadline date,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_os.daily_agendas (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.households(id) on delete cascade,
  kid_id text not null,
  agenda_date date not null,
  joke text,
  fact text,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'client' check (generated_by in ('cron', 'client')),
  foreign key (family_id, kid_id)
    references family_os.child_profiles(family_id, id) on delete cascade,
  unique (family_id, kid_id, agenda_date)
);

-- Follow-ups preserve the existing briefing shape. Source IDs are polymorphic
-- references (including browser-local actions and two-event conflicts), so they
-- are descriptive references rather than direct foreign keys to one table.
create table family_os.briefing_followups (
  family_id uuid not null references public.households(id) on delete cascade,
  key text not null check (length(key) > 0),
  title text not null,
  source text not null check (source in ('assignment', 'chore', 'action', 'event', 'conflict')),
  source_id text not null,
  review_date date not null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  primary key (family_id, key)
);

-- A view cannot be a foreign-key target. This invoker helper validates the
-- union of real adult memberships and app-local children without bypassing RLS.
create function family_os.is_family_person(p_family_id uuid, p_person_id text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_family_id = (select family_os.current_family_id()) and (
    exists (select 1 from public.household_members m
      where m.household_id = p_family_id and m.user_id::text = p_person_id
        and m.role in ('owner', 'member'))
    or exists (select 1 from family_os.child_profiles c
      where c.family_id = p_family_id and c.id = p_person_id)
  )
$$;
revoke all on function family_os.is_family_person(uuid, text) from public, anon;
grant execute on function family_os.is_family_person(uuid, text) to authenticated, service_role;

create function family_os.validate_person_references()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare person_id text;
begin
  if tg_table_name = 'chores' then
    if new.assignee_id is not null and
      not coalesce(family_os.is_family_person(new.family_id, new.assignee_id), false) then
      raise exception using errcode = '23503', message = 'Chore assignee must belong to the same active family';
    end if;
  elsif tg_table_name = 'events' then
    foreach person_id in array new.attendee_ids loop
      if person_id is null or
        not coalesce(family_os.is_family_person(new.family_id, person_id), false) then
        raise exception using errcode = '23503', message = 'Event attendees must belong to the same active family';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function family_os.validate_person_references() from public, anon, authenticated;
create trigger chores_person_scope before insert or update on family_os.chores
  for each row execute function family_os.validate_person_references();
create trigger events_person_scope before insert or update on family_os.events
  for each row execute function family_os.validate_person_references();

-- The server owns completion accountability. Client-supplied audit values
-- cannot attribute a Done transition to another account or change prior audit.
create function family_os.stamp_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'Done' then
    if tg_op = 'INSERT' or old.status is distinct from 'Done' then
      new.completed_at := now();
      new.completed_by_id := auth.uid();
    else
      new.completed_at := old.completed_at;
      new.completed_by_id := old.completed_by_id;
    end if;
  else
    new.completed_at := null;
    new.completed_by_id := null;
  end if;
  return new;
end;
$$;
revoke all on function family_os.stamp_completion() from public, anon, authenticated;
create trigger assignments_completion before insert or update on family_os.assignments
  for each row execute function family_os.stamp_completion();
create trigger chores_completion before insert or update on family_os.chores
  for each row execute function family_os.stamp_completion();

-- Explicit grants and per-operation RLS cover every new exposed base table.
-- The current-family lookup validates both profile selection and actual membership.
do $$
declare
  table_name text;
  read_family_function text;
  write_family_function text;
begin
  foreach table_name in array array[
    'child_profiles', 'students', 'assignments', 'chores', 'events',
    'transactions', 'budgets', 'savings_goals', 'daily_agendas', 'briefing_followups'
  ] loop
    -- Finance is owner-only for reads as well as writes. Students/children can
    -- be read by members but only the household owner can mutate them.
    read_family_function := case when table_name = any(array['transactions', 'budgets', 'savings_goals'])
      then 'current_owner_family_id' else 'current_family_id' end;
    write_family_function := case when table_name = any(array['child_profiles', 'students', 'transactions', 'budgets', 'savings_goals'])
      then 'current_owner_family_id' else 'current_family_id' end;
    execute format('alter table family_os.%I enable row level security', table_name);
    execute format('revoke all on family_os.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on family_os.%I to authenticated, service_role', table_name);
    execute format('create policy %I on family_os.%I for select to authenticated using (family_id = (select family_os.%I()))', table_name || '_select_active_family', table_name, read_family_function);
    execute format('create policy %I on family_os.%I for insert to authenticated with check (family_id = (select family_os.%I()))', table_name || '_insert_active_family', table_name, write_family_function);
    execute format('create policy %I on family_os.%I for update to authenticated using (family_id = (select family_os.%I())) with check (family_id = (select family_os.%I()))', table_name || '_update_active_family', table_name, write_family_function, write_family_function);
    execute format('create policy %I on family_os.%I for delete to authenticated using (family_id = (select family_os.%I()))', table_name || '_delete_active_family', table_name, write_family_function);
    -- Composite primary/unique indexes already lead with family_id on these tables.
    if table_name <> all(array['child_profiles', 'students', 'daily_agendas', 'briefing_followups']) then
      execute format('create index %I on family_os.%I (family_id)', table_name || '_family_id_idx', table_name);
    end if;
  end loop;
end;
$$;

create index assignments_student_family_idx on family_os.assignments (family_id, student_id);
create index students_child_family_idx on family_os.students (family_id, child_profile_id);
create index daily_agendas_date_idx on family_os.daily_agendas (agenda_date);

-- Realtime additions are additive and confined to new Family OS tables.
-- Remove this block if the existing app's publication setup is not verified.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['students', 'assignments', 'chores', 'events', 'transactions', 'budgets', 'savings_goals', 'daily_agendas', 'briefing_followups'] loop
      execute format('alter publication supabase_realtime add table family_os.%I', table_name);
    end loop;
  end if;
end;
$$;

-- API setup remains separate: append family_os to the existing exposed schemas,
-- preserve their order/values, and reload PostgREST schema cache. Do not change
-- Auth settings, default privileges in public, unrelated policies, or recipes.
-- service_role cron must query child_profiles directly; compatibility profiles
-- is scoped to auth.uid() and intentionally returns no rows without an account.
