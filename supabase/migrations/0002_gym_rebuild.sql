-- Gym tab rebuild — retire the old exercises/workout_sets/personal_records
-- tables (superseded by the new split/session model) and introduce
-- gym_sessions + gym_split_config.
--
-- `drop table ... cascade` also drops that table's own RLS policies
-- automatically (policies are owned by the table), so no explicit
-- `drop policy` statements are needed here.

drop table if exists public.exercises, public.workout_sets, public.personal_records cascade;

-- ---------------------------------------------------------------------------
-- gym_sessions
-- ---------------------------------------------------------------------------
create table public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  date date not null,
  split text not null,
  exercises jsonb not null default '[]'::jsonb,
  unique (user_id, date, split)
);

alter table public.gym_sessions enable row level security;

create policy "gym_sessions_select_own" on public.gym_sessions for select using (auth.uid() = user_id);
create policy "gym_sessions_insert_own" on public.gym_sessions for insert with check (auth.uid() = user_id);
create policy "gym_sessions_update_own" on public.gym_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_sessions_delete_own" on public.gym_sessions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- gym_split_config
-- ---------------------------------------------------------------------------
create table public.gym_split_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  split_id text not null,
  config jsonb not null default '[]'::jsonb,
  unique (user_id, split_id)
);

alter table public.gym_split_config enable row level security;

create policy "gym_split_config_select_own" on public.gym_split_config for select using (auth.uid() = user_id);
create policy "gym_split_config_insert_own" on public.gym_split_config for insert with check (auth.uid() = user_id);
create policy "gym_split_config_update_own" on public.gym_split_config for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_split_config_delete_own" on public.gym_split_config for delete using (auth.uid() = user_id);
