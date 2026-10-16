-- Disposable PostgreSQL fixture only. Never run against a Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);

create table public.families (id text primary key);
create table public.students (
  id text primary key,
  family_id text not null references public.families(id)
);
create table public.family_sources (
  id uuid primary key,
  family_id text not null references public.families(id),
  unique (family_id, id)
);
create table public.family_action_proposals (
  id uuid primary key,
  family_id text not null references public.families(id),
  source_id uuid,
  unique (family_id, id),
  foreign key (family_id, source_id)
    references public.family_sources(family_id, id)
);

insert into public.families values ('family-a'), ('family-b');
insert into public.students values ('student-a', 'family-a'),
                                   ('student-b', 'family-b');
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into public.family_sources values
  ('00000000-0000-0000-0000-000000000011', 'family-a'),
  ('00000000-0000-0000-0000-000000000012', 'family-b');
insert into public.family_action_proposals values
  ('00000000-0000-0000-0000-000000000021', 'family-a',
   '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000022', 'family-b',
   '00000000-0000-0000-0000-000000000012');
