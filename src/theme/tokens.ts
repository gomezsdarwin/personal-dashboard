/**
 * Design tokens mirrored 1:1 from docs/design-reference/HANDOFF.md.
 * Every screen/component should consume values from here rather than
 * hard-coding colors/sizes, so the design stays consistent and easy to retheme.
 */

export const color = {
  text: {
    primary: '#201c2c',
    primaryAlt: '#2a2536',
    secondary: '#5a5470',
    secondaryAlt: '#6a6480',
    tertiary: '#7a7490',
    quaternary: '#8a84a0',
    dimmed: '#a49eb8',
    faint: '#b0a8c2',
  },
  hairline: 'rgba(120,110,150,0.14)',
  track: 'rgba(120,110,150,0.16)',

  /** Solid accent color for active-state text/underlines (e.g. sub-nav tabs) —
   * a readable-on-light-glass pick from the same family as accentDefault. */
  accentText: '#6a56d4',

  /** Semantic status colors (Gym tab hit/miss/pending states, and any future
   * success/danger use) — new additions alongside the pre-existing
   * doneColor/urgencyScale precedents, since those are date-urgency-specific. */
  success: '#2f9e5b',
  successBg: 'rgba(52,199,89,0.14)',
  successBorder: 'rgba(52,199,89,0.32)',
  danger: '#d1394f',
  dangerBg: 'rgba(255,59,72,0.12)',
  dangerBorder: 'rgba(255,59,72,0.30)',
  warning: '#b8860b',
  warningBg: 'rgba(255,196,20,0.20)',
} as const;

/** Type scale — { size, weight, letterSpacing? } in px / RN font-weight strings. */
export const type = {
  screenTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.8 },
  greetingName: { fontSize: 44, fontWeight: '700' as const, letterSpacing: -1 },
  heroNumber: { fontSize: 46, fontWeight: '700' as const, letterSpacing: -1.5 },
  cardTitleLg: { fontSize: 19, fontWeight: '700' as const },
  cardTitle: { fontSize: 17, fontWeight: '700' as const },
  greetingLabel: { fontSize: 17, fontWeight: '500' as const },
  itemTitle: { fontSize: 16, fontWeight: '600' as const },
  itemTitleMedium: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  meta: { fontSize: 13, fontWeight: '400' as const },
  metaMedium: { fontSize: 13, fontWeight: '500' as const },
  metaSemibold: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  pill: { fontSize: 11, fontWeight: '700' as const },
  pillLg: { fontSize: 13, fontWeight: '700' as const },
} as const;

export const spacing = {
  screenSide: 18,
  cardPaddingSm: 16,
  cardPaddingLg: 18,
  rowGapSm: 10,
  rowGapMd: 12,
  rowGapLg: 14,
  topSafe: 52,
  bottomTabClearance: 118,
} as const;

export const radius = {
  card: 28,
  chip: 20,
  tabBar: 30,
  input: 14,
  inventoryCard: 24,
  iconTile: 13,
  checkbox: 12, // half of 24px checkbox -> fully round
} as const;

/** Due-date / renewal-date urgency scale — 7 states, exactly per HANDOFF. */
export type UrgencyState =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'soon' // 2-3 days
  | 'week' // 4-7 days
  | 'later' // > 7 days
  | 'none'; // no date set

export const urgencyScale: Record<UrgencyState, { bg: string; fg: string }> = {
  overdue: { bg: 'rgba(230,40,60,0.95)', fg: '#ffffff' },
  today: { bg: 'rgba(255,59,48,0.95)', fg: '#ffffff' },
  tomorrow: { bg: 'rgba(255,95,55,0.92)', fg: '#ffffff' },
  soon: { bg: 'rgba(255,149,0,0.92)', fg: '#ffffff' },
  week: { bg: 'rgba(255,196,20,0.95)', fg: '#5a4200' },
  later: { bg: 'rgba(52,199,89,0.85)', fg: '#ffffff' },
  none: { bg: 'rgba(120,115,150,0.15)', fg: '#6a6480' },
};

/** "Done" override color used for completed tasks/doses (both to-do + subs pills reuse this). */
export const doneColor = { bg: 'rgba(52,199,89,0.85)', fg: '#ffffff' };

/** Glass panel recipes — approximate CSS backdrop-filter recipes using BlurView + border/shadow. */
export const glass = {
  card: {
    tint: 'light' as const,
    intensity: 34,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderRadius: radius.card,
    shadowColor: 'rgba(90,70,130,0.14)',
    shadowOpacity: 1,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
  },
  chip: {
    tint: 'light' as const,
    intensity: 26,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: radius.chip,
  },
  hero: {
    tint: 'light' as const,
    intensity: 34,
    // gradient overlay handled by HeroCard via LinearGradient(140deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))
    gradientColors: ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.08)'] as [string, string],
    borderColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderRadius: radius.card,
    shadowColor: 'rgba(90,70,130,0.16)',
    shadowOpacity: 1,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
  },
  tabBar: {
    tint: 'light' as const,
    intensity: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderRadius: radius.tabBar,
    shadowColor: 'rgba(90,70,130,0.22)',
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 14 },
  },
} as const;

/** Accent gradient stops — presets are in src/theme/accent.ts; this is the default palette. */
export const accentDefault: [string, string] = ['#c8b4ff', '#9db8ff'];

export const accentPalettes = {
  'Lilac-sky': ['#c8b4ff', '#9db8ff'] as [string, string],
  Peach: ['#ffb6c1', '#ffd39b'] as [string, string],
  'Mint-sky': ['#9be8c9', '#8ec8f2'] as [string, string],
  Berry: ['#f7b8d0', '#c9a6f2'] as [string, string],
} as const;

export const tokens = {
  color,
  type,
  spacing,
  radius,
  urgencyScale,
  doneColor,
  glass,
  accentDefault,
  accentPalettes,
} as const;

export default tokens;
