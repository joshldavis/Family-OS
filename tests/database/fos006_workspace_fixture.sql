-- Synthetic stand-in for the catalog-confirmed made-again / family_os shape.
do $$ begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create table public.households (id uuid primary key);
create table public.profiles (
  user_id uuid primary key,
  display_name text,
  current_household_id uuid,
  created_at timestamptz
);
create schema family_os;
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
  foreign key (family_id, student_id)
    references family_os.students(family_id, id)
);
alter table family_os.students enable row level security;
alter table family_os.assignments enable row level security;
insert into public.households values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into family_os.students values
  ('student-a', '00000000-0000-0000-0000-00000000000a'),
  ('student-b', '00000000-0000-0000-0000-00000000000b');
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
