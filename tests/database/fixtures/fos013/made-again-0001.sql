-- Made Again — initial schema
-- Principles: immutable sources, immutable completed Cook Events, append-only
-- promotion into "Our Version", every write scoped to a household.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Households & membership
-- ---------------------------------------------------------------------------
create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  claim_email  text,                         -- a seeded household this email may claim on first sign-in
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

create table public.profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  display_name         text,
  current_household_id uuid references public.households(id) on delete set null,
  created_at           timestamptz not null default now()
);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '30 days',
  revoked_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- Recipes: the library. `source` is immutable. Structured fields may be
-- extracted later, but the original text never changes.
-- ---------------------------------------------------------------------------
create table public.recipes (
  id              text primary key,
  household_id    uuid not null references public.households(id) on delete cascade,
  title           text not null,
  cuisine         text,
  category        text,
  tags            text[] not null default '{}',
  state           text not null default 'Saved',      -- Saved | Modified | ... (seed state; Cooked/Repeat derive from events)
  source_kind     text not null,                       -- conversation | apple-notes | photo | voice | text | web
  source          jsonb not null,                      -- immutable original: {title,url,text,kind,...}
  ingredients     jsonb not null default '[]',
  steps           jsonb not null default '[]',
  notes           jsonb not null default '[]',
  evidence        text,
  canonical_note  text,
  recipe_complete boolean not null default false,
  extraction      jsonb,                               -- {state: measured|extracted|partial|unparsed, method, model, at, confidence}
  servings        text,
  yield           text,
  versions        jsonb not null default '[]',         -- version story entries
  apple_note      jsonb,                               -- {nativeId, modifiedAt, status, links, attachments, relatedRecipeId, duplicateIds}
  extra           jsonb,                               -- everything else carried from the seed, untouched
  capture_id      uuid,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index recipes_household_idx on public.recipes(household_id, created_at desc);
create index recipes_search_idx on public.recipes
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(source->>'text','')));

-- ---------------------------------------------------------------------------
-- Cook Events: the atomic unit.
-- ---------------------------------------------------------------------------
create table public.cook_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  recipe_id     text not null references public.recipes(id) on delete cascade,
  actor         uuid references auth.users(id) on delete set null,
  status        text not null check (status in ('active','complete')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  outcome       text check (outcome in ('Make Again','Good','Needs Work','Nope')),
  notes         text not null default '',
  modifications jsonb not null default '[]',   -- [{id,text,recordedAt,kind,photoPath?}]
  promoted_ids  jsonb not null default '[]',   -- ids of modifications promoted into Our Version
  snapshot      jsonb not null,                -- recipe as it was at start (title, ingredients, steps, retainedChanges, sourceText?)
  revision      integer not null default 0,
  legacy        jsonb                          -- provenance for imported rows
);
create unique index cook_events_active_unique on public.cook_events(household_id, recipe_id) where status = 'active';
create index cook_events_recipe_idx on public.cook_events(household_id, recipe_id, completed_at);

-- ---------------------------------------------------------------------------
-- Captures: every photo / voice / text intake and what became of it.
-- ---------------------------------------------------------------------------
create table public.captures (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  actor         uuid references auth.users(id) on delete set null,
  kind          text not null check (kind in ('photo','voice','text')),
  context       text not null default 'recipe' check (context in ('recipe','cook')),
  storage_path  text,
  raw_text      text,
  draft         jsonb,
  model         text,
  confidence    numeric,
  latency_ms    integer,
  error         text,
  status        text not null default 'drafted' check (status in ('drafted','saved','discarded')),
  usable        boolean,                       -- saved without discarding; set at resolution
  corrections   integer,                       -- fields the user edited before saving
  recipe_id     text references public.recipes(id) on delete set null,
  cook_event_id uuid references public.cook_events(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index captures_household_idx on public.captures(household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- App events: instrumentation for the loop metrics.
-- ---------------------------------------------------------------------------
create table public.app_events (
  id           bigint generated always as identity primary key,
  household_id uuid references public.households(id) on delete cascade,
  user_id      uuid,
  name         text not null,
  props        jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index app_events_household_idx on public.app_events(household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- Sources are immutable.
create or replace function public.recipes_guard()
returns trigger language plpgsql as $$
begin
  if new.source is distinct from old.source then
    raise exception 'recipe source is immutable';
  end if;
  if new.household_id is distinct from old.household_id then
    raise exception 'recipe cannot move households';
  end if;
  return new;
end $$;
create trigger recipes_guard before update on public.recipes
  for each row execute function public.recipes_guard();

-- Completed Cook Events are immutable; snapshots never change.
create or replace function public.cook_events_guard()
returns trigger language plpgsql as $$
begin
  if old.status = 'complete' then
    raise exception 'completed cook events are immutable';
  end if;
  if new.snapshot is distinct from old.snapshot
     or new.started_at is distinct from old.started_at
     or new.recipe_id is distinct from old.recipe_id
     or new.household_id is distinct from old.household_id then
    raise exception 'cook event identity and snapshot are immutable';
  end if;
  return new;
end $$;
create trigger cook_events_guard before update on public.cook_events
  for each row execute function public.cook_events_guard();

-- First sign-in: claim a seeded household by email, else create one.
create or replace function public.ensure_household(p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  mail  text := auth.email();
  hid   uuid;
  nm    text;
begin
  if uid is null then raise exception 'not signed in'; end if;

  insert into public.profiles(user_id, display_name)
  values (uid, p_display_name) on conflict (user_id) do nothing;

  select current_household_id into hid from public.profiles where user_id = uid;
  if hid is not null and public.is_member(hid) then return hid; end if;

  select household_id into hid from public.household_members where user_id = uid order by joined_at limit 1;
  if hid is null and mail is not null then
    select h.id into hid from public.households h
    where lower(h.claim_email) = lower(mail)
      and not exists (select 1 from public.household_members m where m.household_id = h.id)
    limit 1;
    if hid is not null then
      insert into public.household_members(household_id, user_id, role, display_name)
      values (hid, uid, 'owner', p_display_name);
    end if;
  end if;
  if hid is null then
    nm := coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(mail, 'My'), '@', 1));
    insert into public.households(name, created_by) values (nm || '''s Kitchen', uid) returning id into hid;
    insert into public.household_members(household_id, user_id, role, display_name)
    values (hid, uid, 'owner', p_display_name);
  end if;

  update public.profiles set current_household_id = hid,
    display_name = coalesce(display_name, p_display_name) where user_id = uid;
  return hid;
end $$;

-- Join a household through an invite link.
create or replace function public.join_household(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv public.household_invites%rowtype;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from public.household_invites
  where token = p_token and revoked_at is null and expires_at > now();
  if inv.id is null then raise exception 'invite is invalid or expired'; end if;

  insert into public.profiles(user_id) values (uid) on conflict (user_id) do nothing;
  insert into public.household_members(household_id, user_id, role)
  values (inv.household_id, uid, 'member') on conflict do nothing;
  update public.profiles set current_household_id = inv.household_id where user_id = uid;
  return inv.household_id;
end $$;

create or replace function public.switch_household(h uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(h) then raise exception 'not a member'; end if;
  update public.profiles set current_household_id = h where user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles          enable row level security;
alter table public.household_invites enable row level security;
alter table public.recipes           enable row level security;
alter table public.cook_events       enable row level security;
alter table public.captures          enable row level security;
alter table public.app_events        enable row level security;

create policy households_select on public.households for select using (public.is_member(id));
create policy households_update on public.households for update using (public.is_member(id));

create policy members_select on public.household_members for select using (public.is_member(household_id));
create policy members_update_self on public.household_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy profiles_all on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy invites_select on public.household_invites for select using (public.is_member(household_id));
create policy invites_insert on public.household_invites for insert with check (public.is_member(household_id) and created_by = auth.uid());
create policy invites_update on public.household_invites for update using (public.is_member(household_id));

create policy recipes_all on public.recipes for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy cook_events_all on public.cook_events for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy captures_all on public.captures for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy app_events_all on public.app_events for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for capture photos, keyed by household id prefix.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('captures', 'captures', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy captures_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'captures' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy captures_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'captures' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy captures_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'captures' and public.is_member(((storage.foldername(name))[1])::uuid));
