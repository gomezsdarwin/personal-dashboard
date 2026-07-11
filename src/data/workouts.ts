/**
 * Gym exercise library, split definitions, and lookup helpers — ported from
 * the original web spec's `data/workouts.js` (see `FitnessTab` doc, §3).
 *
 * This module is pure data + pure functions; it owns no persistence. Sessions
 * and split configs are persisted via the generic repo (`src/lib/db.ts`)
 * against the `gym_sessions` / `gym_split_config` tables — see
 * `src/lib/types.ts` for `GymSessionRow` / `GymSplitConfigRow`.
 */

import type { GymSessionExercise, GymSessionRow, GymSplitConfigRow, NewRow } from '../lib/types';

/** A single selectable exercise option within a slot (primary or alt). */
export type ExerciseOption = {
  id: string;
  name: string;
  defaultWeight: number;
};

/** A primary library exercise; optionally offers alternates that share its slot. */
export type Exercise = ExerciseOption & {
  alts?: ExerciseOption[];
};

export type Split = {
  id: string;
  label: string;
  day: string;
  muscles: string[];
};

/** A default (pre-customization) slot for a split: which muscle it belongs to. */
export type SlotRef = {
  slot: string;
  muscle: string;
};

// ---------------------------------------------------------------------------
// 3.1 Splits
// ---------------------------------------------------------------------------

export const SPLITS: Split[] = [
  { id: 'push', label: 'Push', day: 'Mon', muscles: ['Chest', 'Shoulders', 'Triceps', 'Abs'] },
  { id: 'pull', label: 'Pull', day: 'Tue', muscles: ['Back', 'Biceps'] },
  { id: 'legs', label: 'Legs', day: 'Wed', muscles: ['Legs'] },
  { id: 'chest_back', label: 'Chest + Back', day: 'Thu', muscles: ['Chest', 'Back'] },
  { id: 'shoulders_arms', label: 'Sh + Arms', day: 'Fri', muscles: ['Shoulders', 'Triceps', 'Biceps'] },
  { id: 'legs_run', label: 'Legs / Run', day: 'Sat', muscles: ['Legs'] },
];
// (Sunday has no split — treated as rest day.)

/** index = Date.getDay(): 0=Sun(rest) 1=Mon(push) ... 6=Sat(legs_run) */
export const DAY_SPLIT: (string | null)[] = [
  null,
  'push',
  'pull',
  'legs',
  'chest_back',
  'shoulders_arms',
  'legs_run',
];

export function todaySplit(): string | null {
  return DAY_SPLIT[new Date().getDay()];
}

/** Merges the static `SPLITS` with any user-created splits recorded in
 * `gym_split_config` (rows with `is_custom === true`), regardless of
 * `hidden` status. Used for label lookups so historical sessions/logs keep
 * resolving a real label even after a split is later hidden from the picker
 * (see `getVisibleSplits` for the filtered, picker-facing variant). */
export function getAllSplits(configRows: GymSplitConfigRow[]): Split[] {
  const customSplits: Split[] = configRows
    .filter((c) => c.is_custom)
    .map((c) => ({ id: c.split_id, label: c.label || c.split_id, day: '', muscles: [] }));
  return [...SPLITS, ...customSplits];
}

/** `getAllSplits` filtered down to splits not marked `hidden` — the
 * authoritative, selectable list for the split picker. */
export function getVisibleSplits(configRows: GymSplitConfigRow[]): Split[] {
  const hiddenIds = new Set(configRows.filter((c) => c.hidden).map((c) => c.split_id));
  return getAllSplits(configRows).filter((s) => !hiddenIds.has(s.id));
}

// ---------------------------------------------------------------------------
// 3.2 Exercise library
// ---------------------------------------------------------------------------

export const MUSCLES: Record<string, Exercise[]> = {
  Chest: [
    { id: 'incline_press', name: 'Incline Press', defaultWeight: 70 },
    {
      id: 'mtl_cable_fly',
      name: 'MtL Cable Fly',
      defaultWeight: 40,
      alts: [{ id: 'pec_dec', name: 'Pec Dec', defaultWeight: 115 }],
    },
    { id: 'machine_press', name: 'Machine Press', defaultWeight: 115 },
  ],
  Shoulders: [
    {
      id: 'mach_sh_press',
      name: 'Machine Shoulder Press',
      defaultWeight: 95,
      alts: [{ id: 'planet_press', name: 'Planet Press', defaultWeight: 85 }],
    },
    { id: 'lateral_raises', name: 'Lateral Raises', defaultWeight: 20 },
    {
      id: 'rear_delt_fly',
      name: 'Rear Delt Fly',
      defaultWeight: 20,
      alts: [{ id: 'pec_dec_rev', name: 'Pec Dec Reverse Fly', defaultWeight: 85 }],
    },
  ],
  Triceps: [
    { id: 'oh_cable_ext', name: 'Overhead Cable Ext', defaultWeight: 35 },
    { id: 'uni_pushdown', name: 'Unilateral Pushdown', defaultWeight: 25 },
  ],
  Abs: [
    { id: 'decline_situp', name: 'Decline Sit Up', defaultWeight: 25 },
    {
      id: 'cable_crunch',
      name: 'Cable Crunches',
      defaultWeight: 60,
      alts: [{ id: 'seated_crunch', name: 'Seated Crunches', defaultWeight: 60 }],
    },
  ],
  Back: [
    { id: 'lat_pulldown', name: 'Wide Lat Pulldowns', defaultWeight: 120 },
    {
      id: 'upper_back_row',
      name: 'Upper Back Row',
      defaultWeight: 105,
      alts: [{ id: 'chest_sup_row', name: 'Chest Supported Row', defaultWeight: 10 }],
    },
    { id: 'uni_row', name: 'Unilateral Row', defaultWeight: 50 },
    { id: 'face_pull', name: 'Face Pull', defaultWeight: 40 },
  ],
  Biceps: [
    { id: 'hammer_curl', name: 'Hammer Curl', defaultWeight: 45 },
    {
      id: 'preacher_curl',
      name: 'Preacher Curl',
      defaultWeight: 25,
      alts: [{ id: 'mach_preacher', name: 'Machine Preacher', defaultWeight: 50 }],
    },
  ],
  Legs: [
    {
      id: 'smith_squat',
      name: 'Smith Machine Squat',
      defaultWeight: 55,
      alts: [{ id: 'leg_press', name: 'Leg Press', defaultWeight: 140 }],
    },
    { id: 'rdl', name: 'Romanian Deadlifts', defaultWeight: 35 },
    { id: 'bss', name: 'Bulgarian Split Squats', defaultWeight: 15 },
    { id: 'leg_ext', name: 'Leg Extension', defaultWeight: 60 },
    {
      id: 'leg_curl',
      name: 'Leg Curls',
      defaultWeight: 55,
      alts: [{ id: 'laying_curl', name: 'Laying Curls', defaultWeight: 45 }],
    },
    { id: 'calf_ext', name: 'Calf Extension', defaultWeight: 125 },
  ],
};

// ---------------------------------------------------------------------------
// 3.3 Lookup helpers
// ---------------------------------------------------------------------------

/** Returns [primary, ...alts] as {id, name, defaultWeight} options for a slot. */
export function getSlotOptions(slotId: string): ExerciseOption[] {
  for (const exercises of Object.values(MUSCLES)) {
    const primary = exercises.find((ex) => ex.id === slotId);
    if (primary) {
      return [
        { id: primary.id, name: primary.name, defaultWeight: primary.defaultWeight },
        ...(primary.alts ?? []),
      ];
    }
  }
  return [];
}

/** Given any exercise id (primary or alt), return the owning slot's primary id. */
export function findSlot(exerciseId: string): string {
  for (const exercises of Object.values(MUSCLES)) {
    for (const primary of exercises) {
      if (primary.id === exerciseId) return primary.id;
      if (primary.alts?.some((a) => a.id === exerciseId)) return primary.id;
    }
  }
  return exerciseId;
}

/** Given any exercise id, return its muscle group name. */
export function getMuscle(exerciseId: string): string | null {
  for (const [muscle, exercises] of Object.entries(MUSCLES)) {
    for (const primary of exercises) {
      if (primary.id === exerciseId) return muscle;
      if (primary.alts?.some((a) => a.id === exerciseId)) return muscle;
    }
  }
  return null;
}

/** Default slot list for a split (before any user customization). */
export function getDefaultSlots(splitId: string): SlotRef[] {
  const split = SPLITS.find((s) => s.id === splitId);
  if (!split) return [];
  return split.muscles.flatMap((muscle) =>
    (MUSCLES[muscle] ?? []).map((ex) => ({ slot: ex.id, muscle }))
  );
}

export function getAvailableSlots(splitId: string, currentSlotIds: Iterable<string>): SlotRef[] {
  const current = new Set(currentSlotIds);
  return getDefaultSlots(splitId).filter((s) => !current.has(s.slot));
}

// ---------------------------------------------------------------------------
// 3.4 Demo session data
// ---------------------------------------------------------------------------
// Adapted from the web spec's `seedDemoData()`: instead of a bespoke
// localStorage-gated seeder, this exports a plain fixture array shaped for
// `useRepo('gym_sessions', DEMO_SESSIONS)` — the hook already gates one-time
// seeding via its own `pd:seeded:<table>` AsyncStorage flag, so no second
// seeding gate is built here.

/** YYYY-MM-DD string for `n` days before today. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Builds a 3-set array sharing one weight, with reps descending slightly
 * across sets to mimic fatigue (e.g. 10/9/8). */
function sets(weight: number, r1: number, r2: number, r3: number): [
  GymSessionExercise['sets'][number],
  GymSessionExercise['sets'][number],
  GymSessionExercise['sets'][number],
] {
  return [
    { weight, reps: r1 },
    { weight, reps: r2 },
    { weight, reps: r3 },
  ];
}

/** Builds one exercise entry for a session from a library primary exercise,
 * applying a progressive-overload weight bump for the given week index
 * (0 = oldest of the 6 demo weeks, 5 = most recent). */
function demoExercise(slot: string, muscle: string, weekIndex: number, repsBase = 10): GymSessionExercise {
  const primary = MUSCLES[muscle]?.find((ex) => ex.id === slot);
  if (!primary) throw new Error(`Unknown demo exercise slot: ${slot}`);
  const weight = primary.defaultWeight + weekIndex * 2.5;
  return {
    slot: primary.id,
    id: primary.id,
    name: primary.name,
    muscle,
    sets: sets(weight, repsBase, repsBase - 1, repsBase - 2),
  };
}

function buildDemoSession(splitId: string, weekIndex: number, daysAgoOffset: number): NewRow<GymSessionRow> {
  const slots = getDefaultSlots(splitId);
  return {
    date: daysAgo(daysAgoOffset),
    split: splitId,
    exercises: slots.map((s) => demoExercise(s.slot, s.muscle, weekIndex)),
  };
}

/**
 * ~18 realistic demo sessions: 6 weeks x Push/Pull/Legs, one session of each
 * per week, spanning roughly daysAgo(42) down to daysAgo(3), with weights
 * trending upward session-over-session per exercise (progressive overload).
 * Sorted newest-first, matching the original seeder's persisted order.
 */
export const DEMO_SESSIONS: NewRow<GymSessionRow>[] = (() => {
  const sessions: NewRow<GymSessionRow>[] = [];
  for (let week = 0; week < 6; week += 1) {
    const weekStartOffset = 42 - week * 7; // 42, 35, 28, 21, 14, 7
    sessions.push(buildDemoSession('push', week, weekStartOffset));
    sessions.push(buildDemoSession('pull', week, weekStartOffset - 2));
    sessions.push(buildDemoSession('legs', week, weekStartOffset - 4));
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
})();
