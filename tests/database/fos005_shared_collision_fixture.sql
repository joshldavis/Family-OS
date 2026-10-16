-- Synthetic signature observed in made-again's catalog; no user rows copied.
create schema auth;
create table auth.users (id uuid primary key);
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  current_household_id uuid,
  created_at timestamptz not null default now()
);
