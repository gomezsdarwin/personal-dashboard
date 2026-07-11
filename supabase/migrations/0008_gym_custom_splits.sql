-- User-created splits + hidden (soft-deleted) splits. `is_custom` marks a
-- gym_split_config row as itself *being* a user-defined split (not just a
-- config/label override for a static SPLITS entry from workouts.ts).
-- `hidden` excludes a split (built-in or custom) from the picker without
-- touching historical gym_sessions rows logged under it.

alter table public.gym_split_config
  add column if not exists is_custom boolean not null default false,
  add column if not exists hidden boolean not null default false;
