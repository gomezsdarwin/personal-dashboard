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
};

const DEFAULTS: PersistedSettings = {
  mode: 'dark',
  glassOpacity: 0.12,
  glassTint: '#ffffff',
  artworkId: defaultArtworkId,
  displayName: '',
};

/** Concrete, ready-to-use glass style values derived from the current theme state. */
export type GlassRecipe = {
  /** Card/chip/tabBar background fill: tint color at glassOpacity. */
  fill: string;
  /** 1px border color for the resting state (~15% opacity). */
  borderBase: string;
  /** 1px border color for the elevated/active state (~30% opacity). */
  borderElevated: string;
  /** Specular top-left -> bottom-right border gradient stops, for the LinearGradient
   *  "1px border" wrapper trick used by GlassCard/GlassChip/HeroCard/TabBar. */
  borderGradient: [string, string];
  /** Slightly brighter variant of borderGradient for elevated/active surfaces. */
  borderGradientElevated: [string, string];
  /** Diagonal fill gradient used by HeroCard (brighter top-left glaze over the flat fill). */
  heroGradient: [string, string];
  /** Scrim color laid over the background artwork for legibility, theme-aware. */
  scrim: string;
  /** expo-blur <BlurView> props. */
  blurTint: 'light' | 'dark';
  blurIntensity: number;
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

function buildGlass(mode: ThemeMode, glassOpacity: number, glassTint: string): GlassRecipe {
  const palette = palettes[mode];
  return {
    fill: rgba(glassTint, glassOpacity),
    borderBase: 'rgba(255,255,255,0.15)',
    borderElevated: 'rgba(255,255,255,0.30)',
    borderGradient: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.08)'],
    borderGradientElevated: ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.14)'],
    heroGradient: [rgba(glassTint, glassOpacity + 0.14), rgba(glassTint, Math.max(glassOpacity - 0.06, 0.02))],
    scrim: palette.scrim,
    blurTint: mode === 'dark' ? 'dark' : 'light',
    blurIntensity: 50,
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULTS.mode);
  const [glassOpacity, setGlassOpacity] = useState<number>(DEFAULTS.glassOpacity);
  const [glassTint, setGlassTint] = useState<string>(DEFAULTS.glassTint);
  const [artworkId, setArtworkId] = useState<string>(DEFAULTS.artworkId);
  const [displayName, setDisplayName] = useState<string>(DEFAULTS.displayName);

  // Load persisted settings on mount. AsyncStorage is inherently async, so a first-frame
  // flash of the default (dark) theme before a persisted light-mode preference loads is
  // possible — acceptable for this phase per the Phase 2 spec.
  // Older persisted blobs (pre-Phase-3) won't have artworkId/displayName keys — parsed
  // fields are read individually and missing ones simply keep the useState default above,
  // so upgrading in place doesn't clobber previously-persisted opacity/mode/tint.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        if (parsed.mode === 'light' || parsed.mode === 'dark') setMode(parsed.mode);
        if (typeof parsed.glassOpacity === 'number') setGlassOpacity(parsed.glassOpacity);
        if (typeof parsed.glassTint === 'string') setGlassTint(parsed.glassTint);
        if (typeof parsed.artworkId === 'string') setArtworkId(parsed.artworkId);
        if (typeof parsed.displayName === 'string') setDisplayName(parsed.displayName);
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
    const payload: PersistedSettings = { mode, glassOpacity, glassTint, artworkId, displayName };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Best-effort persistence; ignore failures (e.g. storage unavailable).
    });
  }, [mode, glassOpacity, glassTint, artworkId, displayName]);

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
      palette: palettes[mode],
      glass: buildGlass(mode, glassOpacity, glassTint),
    };
  }, [mode, glassOpacity, glassTint, artworkId, displayName]);

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
