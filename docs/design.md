# Lapse — Design / UX (v1)

> Direction settled at spec level; a dedicated UI/UX grill (visual language, wireframes, motion) is still pending — see `docs/grill-checklist.md`. Load design-quality/interface-kit skills before writing frontend code.

## Design principles

1. **Zero-friction write.** Tap = logged. Nothing between the user and the log action — no confirm, no sheet, no navigation. Undo, not confirm.
2. **Glanceable read.** The home list answers "what's slipping?" in one second: urgency order + color, big relative times ("12d ago"), no dense metadata.
3. **Not a todo app.** No checkboxes, no due dates, no streaks, no guilt mechanics. An overdue row is information, not a nag.
4. **One-hand, one-screen.** Everything routine happens on the home list. Detail/edit screens are rare visits.

## Screens

### Home (the app)

- Flat list of rows: Tracker name (+ " · variant" suffix for Variant rows), "last done 12d ago · every 7d" subline, urgency color, big tap target = whole row's log button.
- **Tap** row → instant Entry (now), row animates to fresh state, toast with **Undo** (5s).
- **Long-press** row → log sheet (below).
- Sorted per spec: never-logged (thresholded) → ratio desc → thresholdless group.
- Category filter chips pinned at top (horizontal scroll). "All" default.
- **+ button** (thumb-reachable, bottom) → create Tracker.
- Empty state: 2–3 suggested starter Trackers, one tap to add.

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
| `overdue` | red accent |
| `due-soon` | amber accent |
| `fresh` | green/neutral accent |
| `never` | distinct "unstarted" treatment, sorts top |
| `neutral` (no threshold) | no urgency color, quiet |

Color as accent (dot/bar per row, Tody-style), not full-row fills — full-red screens read as alarm. Exact palette: UI/UX grill.

## Navigation

- Standalone PWA has **no OS back gesture** (iOS): every non-home screen has an explicit back affordance; sheets dismiss by swipe-down.
- Home is the root; max depth 2 (home → detail → edit sheet).

## Feel

- Mobile-first layout; usable at desktop width but not optimised for it.
- Light + dark mode from day one (CSS tokens).
- Optimistic everything: log-tap feedback is instant even offline (outbox), subtle "pending sync" indicator when outbox non-empty.
- Anti-generic guardrail for implementation: no default card grids, no stock component-library look — commit to a distinct direction in the UI/UX grill (big-type list aesthetic is the working candidate).

## Patterns stolen from research

- Tody: per-row color urgency at a glance.
- Last Time I: fixed threshold preset tiers instead of raw number input.
- DoneAgo (v2): home-screen widget logging. Donetick (v2): NFC tag → log without opening app.
