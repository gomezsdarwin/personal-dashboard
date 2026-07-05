# Personal Dashboard — Architecture & Build Spec (React Native / Expo)

Single source of truth. Every subagent MUST read this file plus
`docs/design-reference/HANDOFF.md` (design tokens & screen specs) and
`docs/design-reference/Phone.dc.html` (reference implementation with all data/logic) before writing code.

## Product
A personal "liquid glass" dashboard **native app**. Developed on Windows, used on iPhone. Four tabs:

| Tab route            | Screen   | Purpose                                   |
|----------------------|----------|-------------------------------------------|
| `(tabs)/index`       | Home     | Greeting + To-Do list                     |
| `(tabs)/gym`         | Gym      | Workout tracker (session, volume, PRs)    |
| `(tabs)/finance`     | Finance  | Subscription manager (total, categories)  |
| `(tabs)/peptides`    | Peptides | Dose schedule + inventory                 |

## Stack (LOCKED — do not deviate)
- **Expo (managed workflow, latest SDK) + React Native + TypeScript (strict).**
  Chosen so the app is developed on Windows, run on a physical iPhone via **Expo Go** (no Mac), and
  later shipped as a real iOS app via **EAS Build** (cloud).
- **expo-router** (file-based routing) with a `(tabs)` group for the 4 screens → real "separate pages".
- **Supabase** (`@supabase/supabase-js`) for data + auth. In RN it needs `react-native-url-polyfill/auto`
  and `@react-native-async-storage/async-storage` as the auth storage adapter.
- **Glass effect**: `expo-blur` `BlurView` (there is NO CSS backdrop-filter in RN — BlurView is the only
  way to get the frosted-glass look). **Gradients**: `expo-linear-gradient` (accent gradients, hero card,
  chart bars, inventory/progress fills, wallpaper mesh).
- **Safe area**: `react-native-safe-area-context`.
- **Storage fallback**: `@react-native-async-storage/async-storage` (replaces web localStorage).
- Styling: `StyleSheet.create` + a shared TS theme object. NO CSS files, NO Tailwind, NO styled-components.
- State: React hooks + a thin per-table data layer. No Redux.
- Date input: `@react-native-community/datetimepicker` (Expo-compatible) for the to-do due date.

## Security (Opus-owned, non-negotiable)
- Supabase URL + anon key ONLY from Expo public env vars: `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Expo inlines `EXPO_PUBLIC_*` at build). NEVER hardcode keys.
  Provide `.env.example` (placeholders only). `.env` / `.env.local` are gitignored.
- The anon key is public-by-design; real protection is **Row Level Security**. Every table has RLS enabled,
  every row scoped to `auth.uid() = user_id`. No table world-readable/writable. (Schema already written —
  see `supabase/migrations/0001_init.sql`; reuse it as-is, it is stack-agnostic.)
- If Supabase env vars are absent at runtime, the data layer transparently falls back to AsyncStorage so the
  app still runs for local dev/demo. Fallback must be explicit in code, not silent.
- No secrets, tokens, or PII in committed code, logs, or the repo.

## Data model (Supabase / Postgres) — ALREADY BUILT, reuse
`supabase/migrations/0001_init.sql` defines all 7 tables (all with `id uuid pk`, `user_id uuid default
auth.uid()`, `created_at`, RLS `auth.uid() = user_id`): `tasks`, `exercises`, `workout_sets`,
`personal_records`, `subscriptions`, `peptide_doses`, `peptide_inventory`. Do NOT change it unless a
column is genuinely missing; if you must, add a new migration file `0002_*.sql`, never edit 0001.

## Data layer contract (foundation defines, screens consume)
`src/lib/db.ts` exposes a generic typed repository per table:
```ts
type Repo<T> = {
  list(): Promise<T[]>;
  insert(row: NewRow<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
};
```
Backed by Supabase when configured, else AsyncStorage (namespaced `pd:<table>`). Screens use a
`useRepo(tableName, seedFixtures)` hook returning `{ rows, loading, insert, update, remove }` with
optimistic updates + first-run seeding from in-code fixtures.

## Design system (foundation builds; ALL screens reuse — do not re-implement per screen)
`src/theme/tokens.ts` — a typed theme object mirroring EVERY token in HANDOFF.md (colors, text colors,
type scale, spacing, radii, the 7-state due-date urgency scale, glass recipe params (blur intensity/tint/
border/radius/shadow), accent gradient color stops, wallpaper mesh stops).
Components in `src/components/`:
- `<AppShell>` — wallpaper background (LinearGradient mesh, default "Sunset") + safe-area content area.
  The tab layout lives in `app/(tabs)/_layout.tsx`; AppShell is the per-screen scroll wrapper
  (`ScrollView`, hidden indicator, top safe-area padding, bottom padding ~118px to clear floating tab bar,
  fade/rise-in mount animation via `Animated`/`react-native-reanimated`).
- `<GlassCard>`, `<GlassChip>`, `<HeroCard>` — BlurView-based glass panels per HANDOFF recipes
  (translucent, visible wallpaper through them, hairline light border, rounded per radii tokens).
- `<TabBar>` — custom floating glass bottom bar (BlurView) rendered via expo-router's `tabBar` prop; 4
  tabs (🏠 Home / 🏋️ Gym / 💰 Finance / 💊 Peptides) with a 56×56 rounded glass highlight behind the active
  tab's icon+label. Emoji as icons (Text), matching HANDOFF.
- `<UrgencyPill dueDate>` — renders label+colors from `dueMeta`.
- `<AccentGradient>` / helpers in `src/theme/accent.ts` — LinearGradient presets at the diagonal (buttons/
  checkbox ~145°), vertical (bar chart, top→bottom), horizontal (inventory fill, left→right). Default
  Lilac-sky `#c8b4ff→#9db8ff`.
- `src/lib/dueDate.ts` — `dueMeta(iso: string|null)` EXACTLY per HANDOFF urgency scale + Phone.dc.html
  logic, returning `{label,bg,fg,days}`; plus `fmt(iso)`.
- Auth: `<AuthGate>` — if Supabase configured and no session, show a minimal glass sign-in (email +
  password, with sign-up); if not configured, render children directly (AsyncStorage mode).
- `src/lib/supabase.ts` — client from the EXPO_PUBLIC env vars + AsyncStorage auth adapter +
  `react-native-url-polyfill/auto`; export `isSupabaseConfigured`.

## App structure (expo-router)
- `app/_layout.tsx` — root Stack, wraps everything in `SafeAreaProvider` + `<AuthGate>`.
- `app/(tabs)/_layout.tsx` — `Tabs` with custom `tabBar={<TabBar/>}`, 4 screens.
- `app/(tabs)/index.tsx`, `gym.tsx`, `finance.tsx`, `peptides.tsx` — thin route files that render the
  corresponding screen component from `src/pages/*`.
- Actual screen UIs live in `src/pages/{Home,Gym,Finance,Peptides}/` so feature agents have clean ownership.

## File ownership (prevents collisions between parallel agents)
- **Foundation agent** owns: `package.json`, `app.json`/`app.config.ts`, `tsconfig.json`, `babel.config.js`,
  `.env.example`, `.gitignore` (update), `README.md`, `assets/` (icons/splash), all of `app/` (router + tab
  layout + 4 thin route files), `src/theme/*`, `src/components/*` (shell/tabbar/glass/auth/urgency),
  `src/lib/*` (`supabase.ts`, `db.ts`, `dueDate.ts`, `types.ts`), `src/hooks/useRepo.ts`, and 4 placeholder
  screen components under `src/pages/*/` (header only, compiling).
- **Home agent** owns ONLY `src/pages/Home/*`
- **Gym agent** owns ONLY `src/pages/Gym/*`
- **Finance agent** owns ONLY `src/pages/Finance/*`
- **Peptides agent** owns ONLY `src/pages/Peptides/*`
Feature agents READ anything but WRITE only inside their page folder. Do NOT run `npm install`; foundation
installs deps. Keep imports matching the foundation's exports.

## Quality bar / verification (Windows note)
- `npm install` must succeed. `npx tsc --noEmit` MUST pass with zero errors.
- Run `npx expo-doctor` (or `npx expo config` / prebuild config check) to validate the Expo project — but
  note: an actual iOS binary cannot be compiled on Windows; the user runs it on their iPhone via Expo Go
  (`npx expo start` → scan QR). So verification = install + tsc + expo config validity + lint, NOT an iOS build.
- Strict TypeScript, no stray `any`, no unused vars. Match design tokens precisely.

## Fidelity
High. Reproduce every screen's layout + interactions from Phone.dc.html using RN equivalents (BlurView glass,
LinearGradient bars/gradients, Pressable rows, Animated float-in). Replace static fixtures with
Supabase-backed, user-editable data (add/edit/delete affordances where sensible). Live due-date urgency
recomputed on render. Emoji icons as in HANDOFF.
