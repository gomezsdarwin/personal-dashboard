# Personal Dashboard

A personal "liquid glass" iPhone dashboard built with **Expo (React Native) + TypeScript**.
Four tabs: **Home** (greeting + to-do list), **Gym** (workout tracker), **Finance** (subscription
manager), **Peptides** (dose schedule + inventory). See `docs/ARCHITECTURE.md` and
`docs/design-reference/HANDOFF.md` for the full design/architecture spec.

## Setup

```bash
npm install
```

## Run on your iPhone (no Mac needed)

1. Install **Expo Go** from the App Store on your iPhone.
2. From this project on Windows, run:
   ```bash
   npx expo start
   ```
3. Scan the QR code shown in the terminal with your iPhone's **Camera** app (it will offer to
   open it in Expo Go), or scan it directly from inside the Expo Go app.

Your phone and computer must be on the same Wi-Fi network. If the QR code doesn't connect, try
`npx expo start --tunnel`.

## Configure Supabase (optional — app works locally without it)

The app falls back to on-device storage (`AsyncStorage`) automatically when Supabase isn't
configured, so it runs immediately with no backend. To persist data to a real Supabase project
and enable multi-device sync + auth:

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/migrations/` in order (0001, 0002, ...) — either paste each file
   into the Supabase SQL editor, or use the CLI workflow below (`npm run db:push`), which is the
   recommended way going forward so the remote database never drifts from the migrations in git.
3. Copy `.env.example` to `.env` and fill in your project's URL + anon key (Project Settings →
   API):
   ```bash
   cp .env.example .env
   ```
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Restart `npx expo start` (env vars are read at build/bundle time).

When configured, the app shows a glass sign-in/sign-up screen before the tabs. The anon key is
public-by-design — real protection comes from Postgres Row Level Security, not secrecy of the key.
Never commit a real `.env` file (it's gitignored).

### Database sync

Schema changes live as sequential files in `supabase/migrations/` (`0001_init.sql`,
`0002_gym_rebuild.sql`, ...). To avoid the remote database drifting from what's in git (e.g. someone
pasting one migration into the SQL editor by hand and forgetting the rest), use the Supabase CLI:

1. **One-time setup**, per machine:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
   The project ref is the subdomain of your Supabase URL, e.g. for
   `https://abcdefghijklmnop.supabase.co` the ref is `abcdefghijklmnop`. `login` opens a browser to
   create an access token; `link` will prompt for the database password (Project Settings →
   Database).
2. **After adding a new migration file**, push it to the linked remote:
   ```bash
   npm run db:push
   ```
   This runs `supabase db push`, which compares `supabase/migrations/` against the remote's
   migration history table and applies whatever is missing, in order. Run
   `npx supabase migration list --linked` first if you want to preview what's missing before
   pushing.

If migrations were ever applied by hand (SQL editor) instead of via `db push`, the remote's
migration history can be out of sync even when the tables themselves are correct. In that case run
`npx supabase migration repair --status applied <version>` for each migration version that's
already present remotely, before pushing new ones — otherwise the CLI may try to re-run (and
potentially fail or destructively recreate) tables that already exist.

## Project structure

- `app/` — expo-router routes (`(tabs)` group: Home/Gym/Finance/Peptides), thin files that render
  screen components from `src/pages/*`.
- `src/theme/` — design tokens (`tokens.ts`) and accent gradient presets (`accent.ts`), mirroring
  `docs/design-reference/HANDOFF.md` exactly.
- `src/components/` — shared design-system components: `GlassCard`, `GlassChip`, `HeroCard`,
  `UrgencyPill`, `AppShell`, `TabBar`, `AuthGate`.
- `src/lib/` — `types.ts` (DB row types), `supabase.ts` (client + `isSupabaseConfigured`),
  `dueDate.ts` (`dueMeta`/`fmt`), `db.ts` (generic `Repo<T>`, Supabase or AsyncStorage-backed).
- `src/hooks/useRepo.ts` — per-table data hook with optimistic updates + one-time fixture seeding.
- `src/pages/{Home,Gym,Finance,Peptides}/` — actual screen UIs (owned by individual feature work).
- `supabase/migrations/0001_init.sql` — the Postgres schema + RLS policies (reuse as-is).

## Building a real iOS app later

This project is developed entirely on Windows using Expo Go for day-to-day testing. When ready to
ship to the App Store, use [EAS Build](https://docs.expo.dev/build/introduction/) — Expo's cloud
build service — which compiles a real iOS binary without needing a local Mac:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
```
