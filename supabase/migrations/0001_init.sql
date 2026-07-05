-- Personal Dashboard — initial schema + RLS
-- Run this in the Supabase SQL editor (or via `supabase db push`) for your project.
-- Every table is user-scoped: `user_id` defaults to the signed-in user and
-- RLS policies restrict every operation to `auth.uid() = user_id`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  due_date date,
  done boolean not null default false
);

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  scheme text not null,
  weight text not null,
  is_pr boolean not null default false,
  day_label text not null,
  position int not null default 0
);

alter table public.exercises enable row level security;

create policy "exercises_select_own" on public.exercises for select using (auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- workout_sets (weekly volume)
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Mon..6=Sun
  volume numeric not null default 0,
  logged_on date not null default current_date
);

alter table public.workout_sets enable row level security;

create policy "workout_sets_select_own" on public.workout_sets for select using (auth.uid() = user_id);
create policy "workout_sets_insert_own" on public.workout_sets for insert with check (auth.uid() = user_id);
create policy "workout_sets_update_own" on public.workout_sets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sets_delete_own" on public.workout_sets for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- personal_records
-- ---------------------------------------------------------------------------
create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  lift text not null,
  value text not null
);

alter table public.personal_records enable row level security;

create policy "personal_records_select_own" on public.personal_records for select using (auth.uid() = user_id);
create policy "personal_records_insert_own" on public.personal_records for insert with check (auth.uid() = user_id);
create policy "personal_records_update_own" on public.personal_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personal_records_delete_own" on public.personal_records for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  category text not null,
  amount numeric not null default 0,
  icon text not null default '',
  renews_on date
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions_insert_own" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions_delete_own" on public.subscriptions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- peptide_doses
-- ---------------------------------------------------------------------------
create table if not exists public.peptide_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  amount text not null,
  time_label text not null,
  taken boolean not null default false,
  scheduled_for date not null default current_date
);

alter table public.peptide_doses enable row level security;

create policy "peptide_doses_select_own" on public.peptide_doses for select using (auth.uid() = user_id);
create policy "peptide_doses_insert_own" on public.peptide_doses for insert with check (auth.uid() = user_id);
create policy "peptide_doses_update_own" on public.peptide_doses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "peptide_doses_delete_own" on public.peptide_doses for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- peptide_inventory
-- ---------------------------------------------------------------------------
create table if not exists public.peptide_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  vials int not null default 0,
  recon text not null default '',
  doses_left int not null default 0,
  doses_total int not null default 0
);

alter table public.peptide_inventory enable row level security;

create policy "peptide_inventory_select_own" on public.peptide_inventory for select using (auth.uid() = user_id);
create policy "peptide_inventory_insert_own" on public.peptide_inventory for insert with check (auth.uid() = user_id);
create policy "peptide_inventory_update_own" on public.peptide_inventory for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "peptide_inventory_delete_own" on public.peptide_inventory for delete using (auth.uid() = user_id);
