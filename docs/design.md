# Lapse — Design / UX (v1)

> Visual direction committed 2026-08-15 (UI/UX grill): **"ledger × catppuccin mocha"** — frames 3a (home) + 3b (list) in the design reference. Reference markup: `.scratch/lapse-v1/assets/06-chosen-direction-ledger-mocha.html` (extracted from claude.ai/design project `80c06c41-c051-443b-b504-f0b4a20280a1`, "Lapse Directions.dc.html"). Interactive home/list prototype (accepted 2026-08-15, prototype ticket 12): `.scratch/lapse-v1/assets/12-home-prototype.html` — the behavioral reference for tap-to-log, undo window, log sheet, and search routing. Load design-quality/interface-kit skills before writing frontend code.

## Committed visual direction — ledger × catppuccin mocha

A quiet paper-ledger feel on the Catppuccin Mocha palette: serif names, monospace numbers, subtle noise texture, urgency as thin accent bars.

### Palette (Catppuccin Mocha subset)

| Token | Hex | Use |
|---|---|---|
| base | `#1e1e2e` | App/screen background, bottom bar |
| crust | `#11111b` | Text on lavender (FAB glyph, active chip) |
| surface0 | `#313244` | Slipping cards, row dividers, header rules |
| surface1 | `#45475a` | Card/chip borders, screen frame |
| overlay0 | `#6c7086` | Inactive nav icons, dotted "never" underline |
| overlay1 | `#9399b2` | Section labels, "—" never dash |
| overlay2 | `#a6adc8` | Meta/sublines, header icons, variant suffix |
| subtext1 | `#bac2de` | De-emphasised row names (neutral/never) |
| text | `#cdd6f4` | Primary text |
| red | `#f38ba8` | `overdue` accent |
| peach | `#fab387` | `due-soon` accent |
| green | `#a6e3a1` | `fresh` accent |
| lavender | `#b4befe` | Primary: FAB fill, active category chip |

Texture: full-screen fractal-noise SVG overlay at 0.045 opacity, pointer-events none.

### Type

- **Source Serif 4** (serif): wordmark 600/22; row + card names 600/17; quick-log names 400/16; section labels 400/14 italic (`slipping`, `quick log`); neutral/never row names 400 weight in `subtext1` (never-logged also italic).
- **IBM Plex Mono** (mono): all numbers + meta. Sublines 400/14; big day-counts 500/22 (list) – 500/24 (home cards); category chips 400/14. Neutral counts 400 weight in `overlay1`/`subtext1`.

### Shape & components

- Slipping cards (home): `surface0` fill, 10px radius, 3px left border in urgency accent, 14/16 padding, min-height 58px, big count right.
- Quick-log tiles (home): transparent, 1px `surface1` border, 10px radius, 2-col grid.
- List rows: min-height 56px, 1px `surface0` bottom divider, count right with a 24px-wide 2px underline bar in the urgency accent; `never` gets an em-dash + 2px dotted `overlay0` underline; thresholdless rows get count with no bar.
- Category chips: pill (999px). Active = lavender fill + crust text; inactive = 1px `surface1` border + `overlay2` text.
- Bottom nav: 72px bar, `base` bg, 1px `surface0` top border, five slots — home, list, center **+** FAB (48px lavender circle, crust glyph, soft shadow), activity (clock), settings (sliders). Active icon `text`, inactive `overlay0`.
- Header: serif wordmark left; magnifier icon right (`overlay2`), 1.4 stroke. The earlier sliders icon is dropped (prototype ticket 12): it duplicated the tab bar's settings slot and the list's filter chips.

### Motion

Gentle spring settle (rows/cards easing into place); undo toast slides in like a slip of paper. No bouncy overshoot, no attention-grabbing loops. From prototype ticket 12: long-press threshold 450ms; log settle ≈340ms spring; post-undo-window re-sort is a gentle ~200ms fade, never an instant jump; `prefers-reduced-motion` collapses all of it.

## Branding (settled in branding grill 2026-08-15)

### Name treatment

- **In-app and product surfaces: lowercase "lapse"** — wordmark (Source Serif 4, 600), headers, copy. Capitalized "Lapse" never appears inside the app.
- **OS surfaces: capitalized "Lapse"** — PWA manifest `name` and `short_name`, i.e. the home-screen label. App name in the OS grid, ledger voice inside.

### App icon

- Concept: serif lowercase "l" centered on `base #1e1e2e`, short lavender (`#b4befe`) underline bar beneath — wordmark letter plus the urgency-bar signature. Full-bleed, no transparency (iOS).
- Source: hand-authored SVG in repo, text converted to path (no font dependency). One-off script (sharp) generates the committed PNG set: `192`, `512`, `512 maskable` (glyph within center ~66% safe zone), `180` apple-touch-icon.
- Manifest: `background_color` and `theme_color` both `#1e1e2e`.

### Copy tone

Terse, lowercase, dry. Rules:

- All-lowercase UI strings (proper nouns exempt). No exclamation marks. No guilt language (principle 3).
- Em-dash as separator ("couldn't undo — offline"). Confirmations are past-tense verbs.

Canonical strings (extend here, not ad-hoc):

| Context | String |
|---|---|
| Log toast | `logged ✓` + **undo** action |
| Home, nothing due | `nothing slipping` |
| List, empty | `nothing here yet — add your first tracker` |
| Search, no hits | `no matches` |
| Save failed (queued) | `couldn't save — retrying` |
| Undo failed offline | `couldn't undo — offline` |
| Login failure | `wrong password` |
| Pending chip | `2 queued` (count + clock glyph) |

## Design principles

1. **Zero-friction write.** Tap = logged. Nothing between the user and the log action — no confirm, no sheet, no navigation. Undo, not confirm.
2. **Glanceable read.** The home list answers "what's slipping?" in one second: urgency order + color, big relative times ("12d ago"), no dense metadata.
3. **Not a todo app.** No checkboxes, no due dates, no streaks, no guilt mechanics. An overdue row is information, not a nag.
4. **One-hand, one-screen.** Everything routine happens on the home list. Detail/edit screens are rare visits.

## Screens

> Per the committed direction, home is a **digest** (frame 3a) and the full sorted list is its own tab (frame 3b). This supersedes the earlier "home = flat list with chips" interim decision.

### Home (digest — frame 3a)

- **slipping** section: top ~3 most urgent rows (due-soon/overdue by ratio) as accent-bar cards — name, "every Yd · Nd over / due tomorrow" subline, big day-count.
- **quick log** section: 2-col grid of tiles for frequently/recently logged Trackers — name + "Xd ago"/"never".
- **all items** footer row: count + arrow, navigates to List.
- **Tap** card/tile → instant Entry (now), animates to fresh state (green bar, count "now"), toast with **Undo** (5s). The logged card stays in place, green, for the undo window; on toast expiry the digest re-sorts with a gentle fade and the next most-urgent card takes its slot (prototype ticket 12). **Long-press** (450ms) → log sheet.
- Home magnifier navigates to the List tab with search open — search does not overlay the digest (prototype ticket 12).
- Empty state: 2–3 suggested starter Trackers, one tap to add.

### List (all items — frame 3b)

- Category filter chips at top (horizontal scroll), "All" default; search expands in-place from header magnifier.
- Flat ledger rows: name (+ " · variant" suffix), "last done Xd ago · every Yd" subline, day-count with urgency underline bar.
- Sorted per spec: never-logged (thresholded) → ratio desc → thresholdless group. Tap/long-press same as home; row order is frozen during the 5s undo window (row updates in place, green), re-sorts on toast expiry.
- **Swipe left** on a row reveals a single **details** action, which opens the Tracker detail screen. This is the only way into detail: tap and long-press are both spent on logging, so browsing history gets the gesture that costs nothing on the routine path. List rows only — home cards are the routine surface and stay gesture-free.

### Log sheet (long-press)

Bottom sheet, everything optional, one screen:
- Time: chips **now / 1h ago / yesterday / pick…** (defaults now)
- Duration: quick chips (15m / 30m / 1h / custom), default empty
- Note: single text field
- One primary button: **Log**

### Create/Edit Tracker

- Name field focused on open — type name, hit save, done (minimum viable add).
- Optional, collapsed by default: Category picker (chips), Threshold, Variants (add rows), archive action (edit mode).
- Threshold input: preset chips **1w / 2w / 1m / 3m / 6m / 1y** + custom (number + unit). "No threshold" is the default state.

### Tracker detail / history

- Header: name, threshold, category, current state.
- Per-variant last-done summary if Variants exist.
- Entry list newest-first: relative + absolute time, duration, note. Tap → edit sheet (same fields as log sheet) + delete.

### Archived / Settings

- Archived list: unarchive or hard-delete (confirm names the entry count being destroyed).
- Settings: categories manager, logout. Nothing else in v1.

## Urgency color system

| State | Signal |
|---|---|
| `overdue` | red `#f38ba8` accent bar |
| `due-soon` | peach `#fab387` accent bar |
| `fresh` | green `#a6e3a1` accent bar |
| `never` | em-dash count + dotted `overlay0` underline, de-emphasised italic name, sorts top |
| `neutral` (no threshold) | plain count, no bar, de-emphasised name |

Color as accent (3px card bar / 2px underline bar per row), not full-row fills — full-red screens read as alarm.

## Navigation

- **Bottom tab bar** (from committed direction): home · list · **+** (create Tracker, center FAB) · activity · settings. Activity and settings screens not visually designed yet — follow the direction tokens; activity = recent Entries feed, settings = categories manager + archived list + logout.
- This supersedes the earlier interim decisions "FAB bottom-right" and "settings icon in header" — create lives in the center FAB, settings in the tab bar; header keeps the magnifier only (sliders icon dropped, prototype ticket 12).
- Standalone PWA has **no OS back gesture** (iOS): every non-tab screen has an explicit back affordance; sheets dismiss by swipe-down.
- Tabs are roots; max depth 2 (list → detail → edit sheet). Detail is entered by swiping a list row left and tapping **details**; archived is entered from settings.

## Feel

- Mobile-first layout; usable at desktop width but not optimised for it.
- Dark mode only in v1 (settled in UI/UX grill 2026-08-14). CSS tokens structured so a light theme can be added later without component changes.
- Optimistic everything: log-tap feedback is instant even offline (outbox). Pending indicator (offline-lite grill): mono chip in home header — "2 queued" + clock glyph in `overlay2`, peach when any entry failed; tap → sheet listing queued/failed entries with retry-all / per-entry discard. No per-row pending markers — the ledger stays quiet.
- Anti-generic guardrail for implementation: no stock component-library look — the committed ledger × mocha direction (serif + mono, accent bars, noise texture) is the reference; deviations go through a design.md update, not ad-hoc styling.

## Patterns stolen from research

- Tody: per-row color urgency at a glance.
- Last Time I: fixed threshold preset tiers instead of raw number input.
- DoneAgo (v2): home-screen widget logging. Donetick (v2): NFC tag → log without opening app.
