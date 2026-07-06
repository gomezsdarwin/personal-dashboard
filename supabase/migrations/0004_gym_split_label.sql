-- Split label override — lets a user rename a split's display label (e.g.
-- "Push" -> "Push Day") from the Gym tab's split editor. Nullable: null means
-- "fall back to the static SPLITS label in src/data/workouts.ts".

alter table public.gym_split_config add column label text;
