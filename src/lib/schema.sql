-- ============================================================
-- Family OS — Supabase Schema (Phase 3A)
-- Run this in the Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Families ─────────────────────────────────────────────────
create table if not exists families (
  id           text primary key,
  name         text not null,
  invite_code  text unique not null,
  created_at   timestamptz default now()
);

-- ── Profiles (one per family member; parent links to auth.users) ──
create table if not exists profiles (
  id          text primary key,            -- matches User.id from app
  auth_id     uuid references auth.users(id) on delete set null, -- null for child profiles
  family_id   text references families(id) on delete cascade not null,
  name        text not null,
  email       text,
  role        text not null check (role in ('Parent', 'Child')),
  avatar_url  text,
  points      integer default 0,
  created_at  timestamptz default now()
);

-- ── Students ──────────────────────────────────────────────────
create table if not exists students (
  id            text primary key,
  family_id     text references families(id) on delete cascade not null,
  name          text not null,
  grade         text,
  avatar_url    text,
  student_email text,
  created_at    timestamptz default now()
);

-- ── Assignments ───────────────────────────────────────────────
create table if not exists assignments (
  id                  text primary key,
  family_id           text references families(id) on delete cascade not null,
  student_id          text references students(id) on delete cascade,
  title               text not null,
  subject             text not null,
  due_date            date not null,
  status              text not null default 'Not Started',
  estimated_minutes   integer,
  source              text,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Chores ────────────────────────────────────────────────────
create table if not exists chores (
  id           text primary key,
  family_id    text references families(id) on delete cascade not null,
  assignee_id  text,
  title        text not null,
  due_date     date not null,
  status       text not null default 'Not Started',
  points       integer default 0,
  recurrence   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── Calendar Events ───────────────────────────────────────────
create table if not exists events (
  id               text primary key,
  family_id        text references families(id) on delete cascade not null,
  title            text not null,
  start_time       text not null,   -- ISO string (e.g. "2025-06-01T09:00")
  end_time         text,
  location         text,
  provider         text default 'internal',
  google_event_id  text,
  created_at       timestamptz default now()
);

-- ── Finance: Transactions ─────────────────────────────────────
create table if not exists transactions (
  id           text primary key,
  family_id    text references families(id) on delete cascade not null,
  description  text not null,
  amount       numeric not null,
  category     text,
  date         date not null,
  type         text check (type in ('income', 'expense')),
  created_at   timestamptz default now()
);

-- ── Finance: Budgets ──────────────────────────────────────────
create table if not exists budgets (
  id           text primary key,
  family_id    text references families(id) on delete cascade not null,
  category     text not null,
  limit_amount numeric not null,
  spent        numeric default 0,
  period       text default 'monthly'
);

-- ── Finance: Savings Goals ────────────────────────────────────
create table if not exists savings_goals (
  id         text primary key,
  family_id  text references families(id) on delete cascade not null,
  name       text not null,
  target     numeric not null,
  current    numeric default 0,
  deadline   date,
  icon       text
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table families      enable row level security;
alter table profiles      enable row level security;
alter table students      enable row level security;
alter table assignments   enable row level security;
alter table chores        enable row level security;
alter table events        enable row level security;
alter table transactions  enable row level security;
alter table budgets       enable row level security;
alter table savings_goals enable row level security;

-- Helper function: get the family_id for the current authenticated user
create or replace function get_my_family_id()
returns text language sql stable security definer as $$
  select family_id from profiles where auth_id = auth.uid() limit 1;
$$;

-- ── Policies ─────────────────────────────────────────────────

-- families: visible if you belong to it
create policy "family members can view their family"
  on families for select using (id = get_my_family_id());

create policy "family members can update their family"
  on families for update using (id = get_my_family_id());

create policy "anyone can insert a family (during onboarding)"
  on families for insert with check (true);

-- profiles: visible within same family
create policy "profiles: read own family"
  on profiles for select using (family_id = get_my_family_id());

create policy "profiles: insert (onboarding)"
  on profiles for insert with check (true);

create policy "profiles: update own family"
  on profiles for update using (family_id = get_my_family_id());

-- Generic macro for the rest of the core tables
-- (students, assignments, chores, events, transactions, budgets, savings_goals)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['students','assignments','chores','events','transactions','budgets','savings_goals']
  loop
    execute format(
      'create policy "%s: read own family" on %I for select using (family_id = get_my_family_id())',
      tbl, tbl
    );
    execute format(
      'create policy "%s: insert own family" on %I for insert with check (family_id = get_my_family_id())',
      tbl, tbl
    );
    execute format(
      'create policy "%s: update own family" on %I for update using (family_id = get_my_family_id())',
      tbl, tbl
    );
    execute format(
      'create policy "%s: delete own family" on %I for delete using (family_id = get_my_family_id())',
      tbl, tbl
    );
  end loop;
end $$;

-- ============================================================
-- Real-time: enable publications for live sync
-- ============================================================
alter publication supabase_realtime add table assignments;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table budgets;
alter publication supabase_realtime add table savings_goals;
