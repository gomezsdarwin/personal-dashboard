# Handoff: Personal Dashboard (iPhone app)

## Overview
A personal iPhone dashboard app with four screens: a Home screen (greeting + to-do list) and three tools reached via a bottom tab bar — a Gym/workout tracker, a Finance/subscription manager, and a Peptide schedule + inventory tracker. Visual theme is "liquid glass": translucent frosted panels over a blurred pastel wallpaper.

## About the Design Files
The files in this bundle (`reference/Phone.dc.html`, `reference/Dashboard.dc.html`) are **design references built in HTML** — interactive prototypes showing intended look, layout, and behavior. They are not production code to copy verbatim. The task is to **recreate this design in your codebase's existing environment** (React Native, SwiftUI, Flutter, native UIKit, etc.) using its established patterns, navigation, and component libraries — or, if this is a fresh project, to pick the framework best suited to a real iPhone app (SwiftUI is a strong default) and implement the design there.

`Phone.dc.html` is the actual app reference (device shell + all 4 screens + interaction logic). `Dashboard.dc.html` is just a thin harness used to host/preview it during design — not meaningful to the handoff itself.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and glass effect values below are final — recreate pixel-close using your platform's native equivalents (e.g. `UIVisualEffectView`/`.ultraThinMaterial` in SwiftUI for the glass blur, SF Pro / system font for type).

## Screens / Views

### 1. Home
**Purpose:** Landing screen — greet the user and surface their to-do list.
**Layout:** Vertical scroll, 18px side padding, content starts below the status bar (52px), ends with 118px bottom padding to clear the floating tab bar.
- Header block (22px top / 20px bottom padding): label "Good morning" (17px/500, color `#5a5470`), user's name (44px/700, `-1px` letter-spacing, color `#201c2c`), then a line combining the date and a due-soon summary (15px/400, `#5a5470`), e.g. "Friday, July 3 · 2 due today or tomorrow."
- Single glass card, "To-Do":
  - Header row: title "To-Do" (19px/700) left, "{N} open" counter (13px/500, `#8a84a0`) right.
  - Add-task row: text input (flex:1, placeholder "Add a task…"), a native date picker input (compact, ~44px wide), and a circular accent-gradient "+" button (42px, white 22px glyph). Enter key or tapping "+" submits.
  - Task rows (one per task), each: circular checkbox (24px) → title (16px/500, strikethrough + dimmed `#a49eb8` when done) → urgency pill (see Design Tokens → Due-date urgency) → small "×" remove glyph.
  - Sort order: soonest-due first, completed tasks sink to the bottom.

### 2. Gym (workout tracker)
**Purpose:** Log/view today's session and track progress.
**Layout:**
- Header: "🏋️ Gym" (34px/700, `-0.8px` letter-spacing) + "Today · Push Day · {date}" (15px, `#5a5470`).
- Glass card "Today's session": one row per exercise — name (16px/600) + sets×reps scheme (13px, `#7a7490`) stacked left; optional "PR" badge (orange gradient pill, 11px/700 white) before the weight; weight right-aligned (15px/700).
- Glass card "Weekly volume": a 7-bar chart (Mon–Sun), bars use the accent vertical gradient, height proportional to that day's volume (min 8% floor so empty days are still visible), day-letter labels below each bar.
- Row of 3 equal-width chip cards for Personal Records: big value (22px/700) + lift name (12px, `#7a7490`).

### 3. Finance (subscription manager)
**Purpose:** See total monthly spend and manage subscriptions.
**Layout:**
- Header: "💰 Finance" (34px/700) + "Subscriptions" subtitle.
- Hero glass card (gradient-tinted, see tokens): "Total monthly" label (14px, `#7a7490`), big total (46px/700, `-1.5px` letter-spacing), "{N} active subscriptions" caption.
- Horizontally-scrolling row of category chips: category name (12px) + its subtotal (17px/700).
- Glass list card of subscriptions, one row each: 42×42 rounded icon tile (emoji, 22px) → name (16px/600) + category (13px, `#8a84a0`) stacked left → cost (16px/700) + renewal-date pill (same urgency-color scale as to-do due dates) stacked right.

### 4. Peptides (peptide management)
**Purpose:** Track today's doses and remaining inventory.
**Layout:**
- Header: "💊 Peptides" (34px/700) + "Schedule & inventory" subtitle.
- Glass card "Today's schedule": one row per dose — checkbox (toggle taken/not taken) → name (16px/600, strikethrough+dim when taken) + amount/route (13px, `#7a7490`) → time (14px/600, `#8a84a0`) right-aligned.
- "Inventory" section label, then one glass card per compound: name (17px/700) + "{N} vials on hand" (13px/600, `#7a7490`) on one row; reconstitution recipe as plain text below (e.g. "5 mg vial · 2 mL BAC → 250 mcg = 0.10 mL"); a thin progress bar (accent horizontal gradient fill on a `rgba(120,110,150,0.16)` track); "{N} doses remaining" caption.

## Interactions & Behavior
- **Navigation:** bottom tab bar (Home / Gym / Finance / Peptides) — tapping an icon swaps the visible screen instantly, no page transition beyond a 0.4s fade/rise-in (`opacity 0→1`, `translateY(8px)→0`) on the new screen's root.
- **Active tab indicator:** a 56×56 rounded-square glass highlight appears behind the active tab's icon+label.
- **To-do add:** typing a title (required) and optionally picking a due date, then pressing Enter or tapping "+", prepends a new open task.
- **To-do toggle/remove:** tap the checkbox to mark done/undone (list re-sorts); tap "×" to delete.
- **Due-date urgency** is computed live from the device's current date (see Design Tokens) — recalculate on every render/day change, don't bake in.
- **Peptide dose toggle:** tap checkbox to mark a dose taken/untaken (visual only in the reference — no persistence/notifications wired; real app should add reminders).
- All chart bars, PR values, subscription costs, and inventory counts are **static sample data** in the reference — wire to real data in the real app.

## State Management
Minimum state needed:
- `currentScreen`: `'home' | 'gym' | 'finance' | 'peptides'`
- `tasks[]`: `{ id, title, dueDate: Date|null, done: boolean }`
- `newTaskTitle`, `newTaskDueDate` (add-form draft state)
- `doses[]`: `{ id, name, amount, time, taken: boolean }` (per day — real app needs a schedule/recurrence model)
- Subscriptions, workout log, PRs, and peptide inventory should be backed by real data models in the shipped app (user-editable); the reference only renders fixture data.
- Derived/computed: due-status per task/subscription (label + color) from `dueDate` vs. today; sorted task list; monthly total & category subtotals from subscriptions list.

## Design Tokens

**Typography:** system font stack throughout — `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif` (use SF Pro / San Francisco natively on iOS).
- Screen title (Gym/Finance/Peptides headers): 34px / 700 / `-0.8px` letter-spacing
- Home greeting name: 44px / 700 / `-1px` letter-spacing
- Hero big number (subs total): 46px / 700 / `-1.5px` letter-spacing
- Section/card titles: 17–19px / 700
- List item titles: 16px / 600
- Meta / secondary text: 13–15px / 400–500
- Pills / badges: 11–13px / 700

**Colors — text:** primary `#201c2c` / `#2a2536`, secondary `#5a5470` / `#6a6480` / `#7a7490` / `#8a84a0`.

**Colors — due-date urgency scale** (applies to to-do due dates and subscription renewal dates alike):
| State | Background | Text |
|---|---|---|
| Overdue | `rgba(230,40,60,0.95)` | white |
| Due today | `rgba(255,59,48,0.95)` | white |
| Tomorrow | `rgba(255,95,55,0.92)` | white |
| In 2–3 days | `rgba(255,149,0,0.92)` | white |
| In 4–7 days | `rgba(255,196,20,0.95)` | `#5a4200` |
| More than 7 days | `rgba(52,199,89,0.85)` | white |
| No date set | `rgba(120,115,150,0.15)` | `#6a6480` |

**Glass panel recipes** (approximate with native blur/vibrancy views on-platform):
- Card: `background: rgba(255,255,255,0.16); backdrop-filter: blur(34px) saturate(1.9); border: 1px solid rgba(255,255,255,0.4); border-radius: 28px; box-shadow: 0 12px 34px rgba(90,70,130,0.14), inset 0 1px 0 rgba(255,255,255,0.8);`
- Small chip: `background: rgba(255,255,255,0.14); backdrop-filter: blur(26px) saturate(1.8); border: 1px solid rgba(255,255,255,0.35); border-radius: 20px;`
- Hero/gradient card (subs total): `background: linear-gradient(140deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08)); backdrop-filter: blur(34px) saturate(1.9); border: 1px solid rgba(255,255,255,0.45); border-radius: 28px;`
- Floating tab bar: `background: rgba(255,255,255,0.18); backdrop-filter: blur(36px) saturate(2); border: 1px solid rgba(255,255,255,0.4); border-radius: 30px; box-shadow: 0 14px 40px rgba(90,70,130,0.22), inset 0 1px 0 rgba(255,255,255,0.9);`
- Key point: panels are intentionally **low-opacity/clear** (not milky white) — the wallpaper should be clearly visible and blurred through every panel.

**Accent gradient** (checkboxes-when-done, add-button, chart bars) — default "Lilac-sky": `#c8b4ff → #9db8ff`, used at 145° (buttons/checkbox), 180° (vertical bar chart), 90° (horizontal inventory bar). Alternate curated palettes (user-selectable in the reference): Peach `#ffb6c1→#ffd39b`, Mint-sky `#9be8c9→#8ec8f2`, Berry `#f7b8d0→#c9a6f2`.

**Wallpaper** (behind all glass, blurred pastel photo + mesh-gradient fallback):
- Sunset (default) mesh: radial `#ffd6e8` / `#c2e9ff` / `#d8c8ff` / `#ffe0f0` over linear `#ffe9f5 → #ece7ff → #e0f3ff`
- Mint: `#cdeedd` / `#bfe3ee` / `#e4e0fb` / `#d7f5e8` over `#e3f7ee → #e6f2fb → #ece7fb`
- Lavender: `#e8f0ff` / `#f3e6ff` / `#ffe6f0` / `#e6ecff` over `#eef0ff → #f5e9ff → #ffeef5`
- Layered photo: pastel sky/gradient photo, `blur(26px) saturate(1.25)`, 55% opacity, plus a soft white scrim gradient on top for legibility.

**Radii:** cards 28px, chips 20px, tab bar 30px, inputs/buttons 14px, inventory cards 24px, icon tiles 13px, checkboxes fully round (24px).
**Spacing:** card padding 16–18px, row gaps 10–14px, screen side padding 18px.
**Device chrome:** status bar with time (left) + signal/5G/battery glyphs (right); dynamic-island pill (118×34, `#08080c`) centered at the top; bezel is a dark titanium gradient (`#3a3a42 → #17171c`).

## Assets
- Wallpaper photo: Unsplash, pastel sky/gradient abstract (`photo-1557683316-973673baf926`) — replace with your own licensed/owned pastel photo or a user-uploaded photo in the shipped app.
- Icons are emoji glyphs, used deliberately as the tab bar icon set: 🏠 Home, 🏋️ Gym, 💰 Finance, 💊 Peptides. Subscription row icons are also emoji (🎬 🎵 ☁️ 🤖 📺 📰) as placeholder brand marks — swap for real app icons/logos in production.

## Files
- `reference/Phone.dc.html` — the primary design reference: iPhone shell + all 4 screens + interaction logic (open in a browser to click through it).
- `reference/Dashboard.dc.html` — preview harness that mounts `Phone.dc.html` with a few tweakable props (display name, accent palette, wallpaper palette); not meaningful to recreate as-is.
- `reference/support.js` — internal runtime dependency of the `.dc.html` files, needed only to view them in a browser; not relevant to your app's implementation.
