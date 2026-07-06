/**
 * Local-device Monday-started week helpers for the habit tracker. Pure display/logic —
 * there is no Supabase table backing this file. All date math is done via local
 * y/m/d Date construction (never `toISOString()` on a raw `new Date()`), matching the
 * UTC-shift-avoidance convention already established in src/lib/dueDate.ts and
 * HomeScreen's toIsoDate/relativeIso helpers.
 */

/** Local-calendar ISO date (YYYY-MM-DD) — avoids UTC-shift bugs from toISOString(). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses a "YYYY-MM-DD" ISO date string into a local-midnight Date. */
function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday-first weekday index (0=Mon..6=Sun) for a Date whose native getDay() is 0=Sun..6=Sat. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** ISO date string of the Monday starting the calendar week containing `date` (local device
 *  time, defaults to now). */
export function weekStartIso(date: Date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  local.setDate(local.getDate() - mondayIndex(local));
  return toIsoDate(local);
}

/** The 7 ISO date strings Mon->Sun for the week starting at `weekStart` ("YYYY-MM-DD", a Monday). */
export function weekDayIsos(weekStart: string): string[] {
  const base = fromIsoDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    return toIsoDate(d);
  });
}

/** Adds (or subtracts, if negative) `days` to an ISO date string, local-calendar-safe. */
export function addDaysIso(iso: string, days: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}
