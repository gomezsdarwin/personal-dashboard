import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, type Palette } from './palettes';
import { defaultArtworkId } from '../data/artworks';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pd:settings:v1';

type PersistedSettings = {
  mode: ThemeMode;
  glassOpacity: number;
  glassTint: string;
  artworkId: string;
  displayName: string;
  todoCollapsed: boolean;
};

const DEFAULTS: PersistedSettings = {
  mode: 'dark',
  glassOpacity: 0.5,
  // 'auto' resolves to a neutral black-on-dark / white-on-light fill (see buildGlass) —
  // this matches sampleindex.html's cards exactly (`bg-black/50`, neutral translucency).
  // A previous pass here defaulted to a steel-blue tint reasoning that neutral white read
  // as flat "smoked glass"; the reference proves that was wrong — its cards are neutral
  // black, and the periwinkle blue (#adc7ff) is used only as an accent for text/icons/
  // active states, never as the card fill. 'auto' is still a personalization knob users
  // can override via the Settings tint swatches (SettingsSheet's TINT_PRESETS).
  glassTint: 'auto',
  artworkId: defaultArtworkId,
  displayName: '',
  todoCollapsed: false,
};

/** Legacy persisted tint values from before the 'auto' neutral default existed —
 *  silently upgraded to 'auto' on load so old AsyncStorage blobs don't keep showing
 *  the wrong-turn blue tint forever. */
const LEGACY_TINTS = new Set(['#9db8ff']);

/** Concrete, ready-to-use glass style values derived from the current theme state. */
export type GlassRecipe = {
  /** Card/chip/hero background fill: neutral (or user tint) color at glassOpacity —
   *  matches sampleindex.html's `bg-black/50`. */
  fill: string;
  /** HeaderBar fill — slightly more transparent than the card fill (`bg-black/40`). */
  fillHeader: string;
  /** TabBar fill — slightly more opaque than the card fill (`bg-black/60`). */
  fillTabBar: string;
  /** 1px flat border color for cards/header (~10-12% opacity — `border-white/10`). */
  borderBase: string;
  /** Stronger neutral surface color used for active/elevated backgrounds (chips, active
   *  mode pill, input focus borders, etc). */
  borderElevated: string;
  /** TabBar's top border (`border-white/15`). */
  borderTabBar: string;
  /** Diagonal fill gradient used by HeroCard (brighter top-left glaze over the flat fill). */
  heroGradient: [string, string];
  /** Scrim color laid over the background artwork for legibility, theme-aware. */
  scrim: string;
  /** expo-blur <BlurView> props. */
  blurTint: 'light' | 'dark';
  /** Card/chip/hero blur intensity (`backdrop-blur-[60px]`). */
  blurIntensity: number;
  /** Header blur intensity (`backdrop-blur-[80px]`). */
  blurIntensityHeader: number;
  /** TabBar blur intensity (`backdrop-blur-[80px]`). */
  blurIntensityTabBar: number;
};

export type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  glassOpacity: number;
  setGlassOpacity: (value: number) => void;
  glassTint: string;
  setGlassTint: (value: string) => void;
  artworkId: string;
  setArtworkId: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  todoCollapsed: boolean;
  setTodoCollapsed: (value: boolean) => void;
  palette: Palette;
  glass: GlassRecipe;
};

/** Parses '#rgb', '#rrggbb', 'rgb(r,g,b)' or 'rgba(r,g,b,a)' into an {r,g,b} triple. */
function parseColorToRgb(input: string): { r: number; g: number; b: number } {
  const hex = input.trim();
  if (hex.startsWith('#')) {
    let h = hex.slice(1);
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const num = parseInt(h.slice(0, 6), 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  const match = hex.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (match) {
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }
  // Fallback: white.
  return { r: 255, g: 255, b: 255 };
}

function rgba(input: string, alpha: number): string {
  const { r, g, b } = parseColorToRgb(input);
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${clamped.toFixed(3)})`;
}

/** Applies an alpha channel to any hex/rgb(a) color — exported for components that need
 *  a themed translucent color outside the GlassRecipe (e.g. HeaderBar's avatar ring). */
export function withAlpha(input: string, alpha: number): string {
  return rgba(input, alpha);
}

function buildGlass(mode: ThemeMode, glassOpacity: number, glassTint: string): GlassRecipe {
  const palette = palettes[mode];
  const isDark = mode === 'dark';

  // Neutral base for the card fill: black in dark mode, white in light mode — this is
  // what sampleindex.html's `bg-black/50` actually is (a flat neutral translucency, NOT
  // tinted by any accent color). 'auto' is the default and always resolves to this;
  // picking an explicit swatch in Settings overrides it with a real tint color.
  const neutralBase = isDark ? '#000000' : '#ffffff';
  const effectiveTint = glassTint === 'auto' ? neutralBase : glassTint;

  // Card opacity is the user-adjustable base (default 0.5, matching bg-black/50).
  // Header/tabBar derive from it with the same +/-0.1 offset the reference uses
  // (40/50/60 — a symmetric spread around the card's 50), so the slider still does
  // something meaningful for every glass surface, not just cards.
  const cardOpacity = glassOpacity;
  const headerOpacity = Math.max(glassOpacity - 0.1, 0.05);
  const tabBarOpacity = Math.min(glassOpacity + 0.1, 0.92);

  const borderBaseAlpha = isDark ? 0.1 : 0.12;
  const borderElevatedAlpha = isDark ? 0.16 : 0.2;
  const borderTabBarAlpha = isDark ? 0.15 : 0.18;
  const borderRgb = isDark ? '255,255,255' : '0,0,0';

  return {
    fill: rgba(effectiveTint, cardOpacity),
    fillHeader: rgba(effectiveTint, headerOpacity),
    fillTabBar: rgba(effectiveTint, tabBarOpacity),
    borderBase: `rgba(${borderRgb},${borderBaseAlpha})`,
    borderElevated: `rgba(${borderRgb},${borderElevatedAlpha})`,
    borderTabBar: `rgba(${borderRgb},${borderTabBarAlpha})`,
    heroGradient: [rgba(effectiveTint, cardOpacity + 0.14), rgba(effectiveTint, Math.max(cardOpacity - 0.06, 0.02))],
    scrim: palette.scrim,
    blurTint: isDark ? 'dark' : 'light',
    blurIntensity: 60,
    blurIntensityHeader: 80,
    blurIntensityTabBar: 80,
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULTS.mode);
  const [glassOpacity, setGlassOpacity] = useState<number>(DEFAULTS.glassOpacity);
  const [glassTint, setGlassTint] = useState<string>(DEFAULTS.glassTint);
  const [artworkId, setArtworkId] = useState<string>(DEFAULTS.artworkId);
  const [displayName, setDisplayName] = useState<string>(DEFAULTS.displayName);
  const [todoCollapsed, setTodoCollapsed] = useState<boolean>(DEFAULTS.todoCollapsed);

  // Load persisted settings on mount. AsyncStorage is inherently async, so a first-frame
  // flash of the default (dark) theme before a persisted light-mode preference loads is
  // possible — acceptable for this phase per the Phase 2 spec.
  // Older persisted blobs (pre-Phase-3/4) won't have artworkId/displayName/todoCollapsed
  // keys — parsed fields are read individually and missing ones simply keep the useState
  // default above, so upgrading in place doesn't clobber previously-persisted opacity/mode/tint.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        if (parsed.mode === 'light' || parsed.mode === 'dark') setMode(parsed.mode);
        if (typeof parsed.glassOpacity === 'number') setGlassOpacity(parsed.glassOpacity);
        if (typeof parsed.glassTint === 'string') {
          setGlassTint(LEGACY_TINTS.has(parsed.glassTint) ? 'auto' : parsed.glassTint);
        }
        if (typeof parsed.artworkId === 'string') setArtworkId(parsed.artworkId);
        if (typeof parsed.displayName === 'string') setDisplayName(parsed.displayName);
        if (typeof parsed.todoCollapsed === 'boolean') setTodoCollapsed(parsed.todoCollapsed);
      })
      .catch(() => {
        // Corrupt/unavailable storage — fall back to defaults silently.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change (after initial load), so the toggle used for QA and any future
  // Settings UI both stick across reloads.
  useEffect(() => {
    const payload: PersistedSettings = {
      mode,
      glassOpacity,
      glassTint,
      artworkId,
      displayName,
      todoCollapsed,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Best-effort persistence; ignore failures (e.g. storage unavailable).
    });
  }, [mode, glassOpacity, glassTint, artworkId, displayName, todoCollapsed]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      mode,
      setMode,
      glassOpacity,
      setGlassOpacity,
      glassTint,
      setGlassTint,
      artworkId,
      setArtworkId,
      displayName,
      setDisplayName,
      todoCollapsed,
      setTodoCollapsed,
      palette: palettes[mode],
      glass: buildGlass(mode, glassOpacity, glassTint),
    };
  }, [mode, glassOpacity, glassTint, artworkId, displayName, todoCollapsed]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be called within a <ThemeProvider>.');
  }
  return ctx;
}

export default ThemeProvider;
