-- Habit tracker — a `habits` list plus a `habit_completions` join table recording
-- which calendar day each habit was completed on. Mirrors 0002_gym_rebuild.sql's
-- conventions exactly (uuid pk, auth.uid()-defaulted user_id, RLS 4-policy set).

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  favorite boolean not null default false,
  position int not null default 0
);

alter table public.habits enable row level security;

create policy "habits_select_own" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- habit_completions
-- ---------------------------------------------------------------------------
create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null,
  unique (user_id, habit_id, completed_on)
);

alter table public.habit_completions enable row level security;

create policy "habit_completions_select_own" on public.habit_completions for select using (auth.uid() = user_id);
create policy "habit_completions_insert_own" on public.habit_completions for insert with check (auth.uid() = user_id);
create policy "habit_completions_update_own" on public.habit_completions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_completions_delete_own" on public.habit_completions for delete using (auth.uid() = user_id);
