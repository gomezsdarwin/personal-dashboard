import { urgencyScale, type UrgencyState } from '../theme/tokens';

export type DueMeta = {
  label: string;
  bg: string;
  fg: string;
  days: number;
  state: UrgencyState;
};

/** Formats an ISO date ("YYYY-MM-DD") as e.g. "Jul 3". Mirrors Phone.dc.html's `fmt`. */
export function fmt(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Computes due-date urgency exactly per Phone.dc.html's `dueMeta` + HANDOFF's 7-state scale.
 * Always recompute live from the current date on render — never cache/bake in.
 */
export function dueMeta(iso: string | null | undefined): DueMeta {
  if (!iso) {
    const s = urgencyScale.none;
    return { label: 'Someday', bg: s.bg, fg: s.fg, days: 9999, state: 'none' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(iso + 'T00:00:00');
  const days = Math.round((dd.getTime() - today.getTime()) / 86400000);

  let label: string;
  let state: UrgencyState;

  if (days < 0) {
    label = 'Overdue';
    state = 'overdue';
  } else if (days === 0) {
    label = 'Today';
    state = 'today';
  } else if (days === 1) {
    label = 'Tomorrow';
    state = 'tomorrow';
  } else if (days <= 3) {
    label = `in ${days}d`;
    state = 'soon';
  } else if (days <= 7) {
    label = `in ${days}d`;
    state = 'week';
  } else {
    label = fmt(iso);
    state = 'later';
  }

  const s = urgencyScale[state];
  return { label, bg: s.bg, fg: s.fg, days, state };
}
