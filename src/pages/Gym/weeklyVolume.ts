import type { WorkoutSetRow } from '../../lib/types';

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type VolumeBar = {
  /** 0=Mon .. 6=Sun */
  dayOfWeek: number;
  letter: string;
  /** Raw summed volume for that day. */
  total: number;
  /** Bar height as a percentage of the chart area, `max(8, round(total/maxTotal*100))`. */
  pct: number;
};

/**
 * Aggregates workout_sets rows into one bar per weekday (Mon..Sun), summing `volume`
 * per `day_of_week`. Mirrors Phone.dc.html's `volRaw` -> `volume` derivation:
 * height% = max(8, round(v / maxV * 100)) so empty/low days still show an 8% floor bar.
 */
export function aggregateWeeklyVolume(rows: WorkoutSetRow[]): VolumeBar[] {
  const totals = new Array(7).fill(0) as number[];
  for (const row of rows) {
    if (row.day_of_week >= 0 && row.day_of_week <= 6) {
      totals[row.day_of_week] += row.volume;
    }
  }
  const maxTotal = Math.max(...totals, 1);
  return totals.map((total, dayOfWeek) => ({
    dayOfWeek,
    letter: DAY_LETTERS[dayOfWeek],
    total,
    pct: Math.max(8, Math.round((total / maxTotal) * 100)),
  }));
}
