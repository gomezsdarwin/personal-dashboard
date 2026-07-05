/**
 * Row types mirroring supabase/migrations/0001_init.sql exactly (column-for-column).
 * Do not add fields that aren't in the schema; add a 0002_*.sql migration first if needed.
 */

export type TaskRow = {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  due_date: string | null; // date (YYYY-MM-DD)
  done: boolean;
};

/** One set of a logged exercise: `weight`/`reps` intentionally allow string
 * (blank input state) as well as number, mirroring the original web spec. */
export type GymSet = {
  weight: number | string;
  reps: number | string;
};

/** One exercise entry within a session's `exercises` JSONB array. `slot` is the
 * owning library slot's primary exercise id (see src/data/workouts.ts); `id` is
 * the actually-selected primary/alt exercise id for that slot. */
export type GymSessionExercise = {
  slot: string;
  id: string;
  name: string;
  muscle: string;
  sets: [GymSet, GymSet, GymSet];
};

export type GymSessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  date: string; // date (YYYY-MM-DD)
  split: string; // split id, e.g. 'push'
  exercises: GymSessionExercise[];
};

/** One entry in a split's `config` JSONB array. Library entries reference a
 * MUSCLES slot; custom entries carry their own name/weight/muscle inline. */
export type GymSplitConfigEntry =
  | { slot: string; id: string; custom?: false }
  | { slot: string; id: string; name: string; defaultWeight: number; muscle: string; custom: true };

export type GymSplitConfigRow = {
  id: string;
  user_id: string;
  created_at: string;
  split_id: string;
  config: GymSplitConfigEntry[];
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  category: string;
  amount: number;
  icon: string;
  renews_on: string | null; // date
};

export type PeptideDoseRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  amount: string;
  time_label: string;
  taken: boolean;
  scheduled_for: string; // date
};

export type PeptideInventoryRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  vials: number;
  recon: string;
  doses_left: number;
  doses_total: number;
};

/** Table name -> row type map, used by the generic Repo<T> factory in src/lib/db.ts. */
export type TableRowMap = {
  tasks: TaskRow;
  gym_sessions: GymSessionRow;
  gym_split_config: GymSplitConfigRow;
  subscriptions: SubscriptionRow;
  peptide_doses: PeptideDoseRow;
  peptide_inventory: PeptideInventoryRow;
};

export type TableName = keyof TableRowMap;

/**
 * Shape needed to insert a new row: everything except server-assigned fields.
 * `id`, `user_id`, `created_at` are always assigned by the DB (or the local fallback).
 */
export type NewRow<T extends { id: string; user_id: string; created_at: string }> = Omit<
  T,
  'id' | 'user_id' | 'created_at'
>;
