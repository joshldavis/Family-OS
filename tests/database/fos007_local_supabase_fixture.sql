-- LOCAL SUPABASE ONLY. This uses real Auth tables and synthetic family rows.
-- Never run against a linked or hosted project.
begin;
do $$
begin
  if current_setting('server_version_num')::int < 170000
    or to_regclass('auth.users') is null
    or to_regclass('auth.sessions') is null
    or to_regclass('public.households') is not null
  then raise exception 'Expected a fresh local Supabase 17 stack'; end if;
end $$;

create table public.households (
  id uuid primary key, name text not null, is_demo boolean not null default false
);
create table public.household_members (
  household_id uuid not null references public.households(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','member')),
  primary key (household_id,user_id)
);
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  current_household_id uuid references public.households(id)
);
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles enable row level security;
revoke all on public.households,public.household_members,public.profiles
  from public,anon,authenticated;
grant select,update on public.households,public.household_members,public.profiles
  to service_role;

create schema family_os;
grant usage on schema family_os to service_role;
create function family_os.current_family_id()
returns uuid language sql stable as $$ select null::uuid $$;
create function family_os.current_owner_family_id()
returns uuid language sql stable as $$ select null::uuid $$;
create table family_os.students (
  id text primary key,
  family_id uuid not null references public.households(id),
  name text not null,
  unique (family_id,id)
);
create table family_os.assignments (
  id text primary key,
  family_id uuid not null references public.households(id),
  student_id text not null,
  title text not null,
  subject text not null default '',
  due_date date not null,
  status text not null default 'Not Started',
  source text check (source in ('Manual','Import','AI')),
  foreign key (family_id,student_id)
    references family_os.students(family_id,id)
);
alter table family_os.students enable row level security;
alter table family_os.assignments enable row level security;
grant select,update on family_os.students to service_role;
grant select,insert,update on family_os.assignments to service_role;
commit;
