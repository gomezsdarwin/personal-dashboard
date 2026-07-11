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
 * MUSCLES slot; custom entries carry their own name/weight/muscle inline.
 * `extraOptions` holds user-added alternatives for a library slot that aren't
 * part of the static `MUSCLES` library (see workouts.ts's `getSlotOptions`).
 * `removedOptionIds` holds static-library option ids the user explicitly
 * deleted for this slot, so they don't get re-merged back in on load. */
export type GymSplitConfigEntry =
  | {
      slot: string;
      id: string;
      custom?: false;
      extraOptions?: { id: string; name: string; defaultWeight: number }[];
      removedOptionIds?: string[];
    }
  | { slot: string; id: string; name: string; defaultWeight: number; muscle: string; custom: true };

export type GymSplitConfigRow = {
  id: string;
  user_id: string;
  created_at: string;
  split_id: string;
  config: GymSplitConfigEntry[];
  /** User override for the split's display label; null/absent means "use the
   * static `SPLITS` label from workouts.ts". */
  label?: string | null;
  /** True when this row IS a user-created split (not merely a config/label
   * override for a built-in `SPLITS` entry). */
  is_custom?: boolean;
  /** True when this split (built-in or custom) has been removed from the
   * picker. Historical `gym_sessions` rows logged under it are untouched. */
  hidden?: boolean;
};

export type SubscriptionCategory = 'Bills' | 'Streaming' | 'Music' | 'Software' | 'Fitness' | 'Others';

export type SubscriptionRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  category: SubscriptionCategory;
  amount: number;
  renews_on: string | null; // date
};

export type PeptideKind = 'peptide' | 'supplement';

export type PeptideDoseRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  amount: string;
  time_label: string;
  taken: boolean;
  scheduled_for: string; // date
  kind: PeptideKind;
};

export type PeptideFrequency = 'daily' | 'everyN' | 'weekdays' | 'asNeeded';

export type PeptideInventoryRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  vials: number;
  recon: string;
  doses_left: number;
  doses_total: number;
  kind: PeptideKind;
  schedule_amount: string;
  schedule_time_label: string;
  /** Structured recon math (peptide kind only) — vial size in mg, bacteriostatic
   * water volume in mL, and a single dose amount in mcg. The UI derives
   * concentration/volume-per-dose/doses-per-vial from these at render time
   * rather than persisting them. Legacy `recon` free text is kept for
   * backward-compat and for 'supplement' rows, which aren't vial-based. */
  vial_mg: number;
  bac_ml: number;
  dose_mcg: number;
  /** Dosing cadence. `frequency_n` is used when frequency === 'everyN' (e.g. 3
   * for "every 3 days"). `frequency_days` is a comma-separated list of day
   * abbreviations (e.g. "Mon,Thu") used when frequency === 'weekdays'. New rows
   * are always created with frequency === 'weekdays' — 'daily'/'everyN'/'asNeeded'
   * are legacy values kept readable for rows created before scheduling was
   * simplified to specific-days-only. */
  frequency: PeptideFrequency;
  frequency_n: number;
  frequency_days: string;
  /** Free-form per-compound note, e.g. a reminder to bump dosage on a future date. */
  note: string;
  /** Single per-compound dose amount in mg (fractional, e.g. 0.25/0.5). Source
   * of truth for inventory subtraction; for 'peptide' rows `dose_mcg` is kept
   * in sync (`dose_mg * 1000`) so the existing recon math keeps working. */
  dose_mg: number;
  /** Real amount remaining, in mg. Total on hand is `vials * vial_mg` for both
   * kinds — `vial_mg` doubles as "amount per unit (mg)" for supplement rows,
   * not just peptide vial size. Taking a dose subtracts `dose_mg` from this,
   * clamped to [0, vials * vial_mg]. */
  amount_left_mg: number;
  /** When true, this compound is paused ("on a break") — excluded from
   * Today's schedule but keeps its inventory, dosage, and day config intact. */
  on_break: boolean;
  /** ISO timestamp of the last time a dose of this compound was checked off
   * as taken. Null means never taken. Not updated on uncheck. */
  last_taken_at: string | null;
};

export type HabitRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  favorite: boolean;
  position: number;
};

export type HabitCompletionRow = {
  id: string;
  user_id: string;
  created_at: string;
  habit_id: string;
  completed_on: string; // date (YYYY-MM-DD)
};

/** Table name -> row type map, used by the generic Repo<T> factory in src/lib/db.ts. */
export type TableRowMap = {
  tasks: TaskRow;
  gym_sessions: GymSessionRow;
  gym_split_config: GymSplitConfigRow;
  subscriptions: SubscriptionRow;
  peptide_doses: PeptideDoseRow;
  peptide_inventory: PeptideInventoryRow;
  habits: HabitRow;
  habit_completions: HabitCompletionRow;
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
