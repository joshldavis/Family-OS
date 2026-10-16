-- Synthetic signature observed in made-again's catalog; no user rows copied.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  current_household_id uuid,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_all on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on public.profiles to anon, authenticated;
