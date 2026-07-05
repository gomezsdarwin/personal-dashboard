/**
 * Accent gradient presets for expo-linear-gradient's <LinearGradient>.
 * Angles from HANDOFF: 145deg diagonal (buttons/checkboxes), 180deg vertical (bar chart),
 * 90deg horizontal (inventory fill). LinearGradient has no `angle` prop — angles are expressed
 * as normalized {start, end} points instead.
 */
import { accentDefault, accentPalettes } from './tokens';

export type AccentGradient = {
  colors: [string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** ~145deg: top-left-ish to bottom-right-ish. */
export function diagonal(colors: [string, string] = accentDefault): AccentGradient {
  return { colors, start: { x: 0, y: 0 }, end: { x: 0.87, y: 1 } };
}

/** 180deg: straight top to bottom. */
export function vertical(colors: [string, string] = accentDefault): AccentGradient {
  return { colors, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
}

/** 90deg: straight left to right. */
export function horizontal(colors: [string, string] = accentDefault): AccentGradient {
  return { colors, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
}

export const accent = {
  default: accentDefault,
  palettes: accentPalettes,
  diagonal,
  vertical,
  horizontal,
} as const;

export default accent;
