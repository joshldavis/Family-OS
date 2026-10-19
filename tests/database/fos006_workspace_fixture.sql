-- Synthetic stand-in for the catalog-confirmed made-again / family_os shape.
do $$ begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
alter role service_role login password 'disposable-ci-only';
create schema auth;
create table auth.users (id uuid primary key);
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  not_after timestamptz
);
revoke all on auth.sessions from public, anon, authenticated, service_role;
create table public.households (id uuid primary key, is_demo boolean not null default false);
create table public.household_members (
  household_id uuid not null references public.households(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','member')),
  primary key (household_id,user_id)
);
create table public.profiles (
  user_id uuid primary key,
  display_name text,
  current_household_id uuid,
  created_at timestamptz
);
create schema family_os;
grant usage on schema family_os to authenticated, service_role;
create function family_os.current_family_id()
returns uuid language sql stable as $$ select null::uuid $$;
create function family_os.current_owner_family_id()
returns uuid language sql stable as $$ select null::uuid $$;
create table family_os.students (
  id text primary key,
  family_id uuid not null references public.households(id),
  unique (family_id, id)
);
create table family_os.assignments (
  id text primary key,
  family_id uuid not null references public.households(id),
  student_id text not null,
  title text not null,
  due_date date not null,
  source text,
  foreign key (family_id, student_id)
    references family_os.students(family_id, id)
);
alter table family_os.students enable row level security;
alter table family_os.assignments enable row level security;
grant select, update on public.households, public.household_members, public.profiles
  to service_role;
grant select, update on family_os.students to service_role;
grant select, insert, update on family_os.assignments to service_role;
insert into public.households values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into family_os.students values
  ('student-a', '00000000-0000-0000-0000-00000000000a'),
  ('student-b', '00000000-0000-0000-0000-00000000000b');
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into public.profiles(user_id,current_household_id)
  values ('00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-00000000000a');
insert into public.household_members values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000001','owner');
insert into auth.sessions values
  ('00000000-0000-0000-0000-000000000101',
   '00000000-0000-0000-0000-000000000001',null),
  ('00000000-0000-0000-0000-000000000102',
   '00000000-0000-0000-0000-000000000001','2020-01-01');
