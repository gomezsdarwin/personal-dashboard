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

export type ExerciseRow = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  scheme: string;
  weight: string;
  is_pr: boolean;
  day_label: string;
  position: number;
};

export type WorkoutSetRow = {
  id: string;
  user_id: string;
  created_at: string;
  day_of_week: number; // 0=Mon .. 6=Sun
  volume: number;
  logged_on: string; // date
};

export type PersonalRecordRow = {
  id: string;
  user_id: string;
  created_at: string;
  lift: string;
  value: string;
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
  exercises: ExerciseRow;
  workout_sets: WorkoutSetRow;
  personal_records: PersonalRecordRow;
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
