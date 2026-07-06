/**
 * Dark + light color palettes for the theme system. Each palette is a superset of the
 * fields the old `color` export in tokens.ts had (text scale, hairline, track, accentText,
 * success/danger/warning + bg/border variants), plus a `scrim` used by AppShell to darken/
 * brighten the background artwork for legibility.
 *
 * Light palette reuses the original HANDOFF dark-on-light values verbatim — they were
 * already tuned for light mode. Dark palette is a new near-white-on-dark scale.
 */

export type Palette = {
  text: {
    primary: string;
    primaryAlt: string;
    secondary: string;
    secondaryAlt: string;
    tertiary: string;
    quaternary: string;
    dimmed: string;
    faint: string;
  };
  hairline: string;
  track: string;
  accentText: string;
  success: string;
  successBg: string;
  successBorder: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  warning: string;
  warningBg: string;
  /** Scrim laid over the background artwork so glass cards/text stay legible. */
  scrim: string;
};

export const dark: Palette = {
  text: {
    primary: '#e8ecf4',
    primaryAlt: '#dbe0ec',
    secondary: '#aab2c8',
    secondaryAlt: '#9aa2ba',
    tertiary: '#848da8',
    quaternary: '#6d7692',
    dimmed: '#5a637c',
    faint: '#4a5268',
  },
  hairline: 'rgba(232,236,244,0.14)',
  track: 'rgba(232,236,244,0.16)',
  accentText: '#b9a8ff',
  success: '#5fd98a',
  successBg: 'rgba(52,199,89,0.20)',
  successBorder: 'rgba(52,199,89,0.38)',
  danger: '#ff7a88',
  dangerBg: 'rgba(255,59,72,0.20)',
  dangerBorder: 'rgba(255,59,72,0.38)',
  warning: '#ffd166',
  warningBg: 'rgba(255,196,20,0.22)',
  scrim: 'rgba(5,10,20,0.4)',
};

export const light: Palette = {
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
  accentText: '#6a56d4',
  success: '#2f9e5b',
  successBg: 'rgba(52,199,89,0.14)',
  successBorder: 'rgba(52,199,89,0.32)',
  danger: '#d1394f',
  dangerBg: 'rgba(255,59,72,0.12)',
  dangerBorder: 'rgba(255,59,72,0.30)',
  warning: '#b8860b',
  warningBg: 'rgba(255,196,20,0.20)',
  // A bit brighter than the 0.25-0.35 starting range: the header text sits directly on the
  // artwork (no glass card behind it) and needs to stay legible over Starry Night's darker
  // blue passages, not just its bright starbursts.
  scrim: 'rgba(255,255,255,0.42)',
};

export const palettes = { dark, light } as const;

export default palettes;
