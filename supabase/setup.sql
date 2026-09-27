-- Fairway Notebook: database setup
-- Run this once in your Supabase project: SQL Editor → New query → paste all of this → Run.
-- It creates three tables and locks each one so only the signed-in owner can see or change their rows.

-- ---------- Rounds ----------
-- A round is either hole by hole (holes = list of {par, score, putts, fir}) or total only (holes is null).
create table if not exists public.rounds (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date             date not null,
  course           text not null,
  tees             text not null default '',
  hole_count       smallint not null check (hole_count in (9, 18)),
  total            smallint not null check (total > 0),
  par              smallint,
  holes            jsonb,
  notes            text not null default '',
  source           text not null default 'manual',   -- 'manual' or 'ghin'
  -- GHIN details
  score_type       text,                              -- Home, Away, Tournament...
  course_rating    numeric(4, 1),
  slope            smallint,
  pcc              numeric(3, 1),                     -- playing conditions calculation
  differential     numeric(4, 1),
  used_in_handicap boolean,
  created_at       timestamptz not null default now()
);

-- ---------- Practice ----------
create table if not exists public.practice_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  area       text not null,
  minutes    smallint not null check (minutes > 0),
  balls      smallint not null default 0,
  focus      text not null default '',
  rating     smallint not null check (rating between 1 and 5),
  notes      text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Workouts ----------
-- exercises = list of {name, sets, reps, load}
create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  type       text not null,
  minutes    smallint not null check (minutes > 0),
  exercises  jsonb not null default '[]'::jsonb,
  notes      text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rounds_user_date on public.rounds (user_id, date desc);
create index if not exists practice_user_date on public.practice_sessions (user_id, date desc);
create index if not exists workouts_user_date on public.workouts (user_id, date desc);

-- ---------- Privacy: row level security ----------
-- With this on, the public key in config.js can only ever reach the rows of whoever is signed in.
alter table public.rounds enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.workouts enable row level security;

drop policy if exists "Owner only" on public.rounds;
create policy "Owner only" on public.rounds for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Owner only" on public.practice_sessions;
create policy "Owner only" on public.practice_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Owner only" on public.workouts;
create policy "Owner only" on public.workouts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- Added in v2.1: routines (practice plans and workout plans)
-- Safe to re-run: it only adds what isn't there yet.
-- =====================================================================
-- items for a practice routine: list of {name, area, minutes, how, score ('none' | 'made' | 'strokes'), outOf, target}
-- items for a workout routine:  list of {name, sets, reps, load}
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('practice', 'workout')),
  name       text not null,
  day        text not null default '',          -- suggested day: Mon, Tue... or blank
  focus      text not null default '',          -- workout type (Strength, Speed...) for workouts
  sort       smallint not null default 0,
  items      jsonb not null default '[]'::jsonb,
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists routines_user on public.routines (user_id, kind, sort);
alter table public.routines enable row level security;
drop policy if exists "Owner only" on public.routines;
create policy "Owner only" on public.routines for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sessions remember which routine they came from; practice sessions keep each drill's result.
alter table public.practice_sessions add column if not exists routine_id uuid references public.routines (id) on delete set null;
alter table public.practice_sessions add column if not exists drills jsonb;
alter table public.workouts add column if not exists routine_id uuid references public.routines (id) on delete set null;
