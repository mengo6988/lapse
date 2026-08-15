# UI/UX direction grill

Type: grilling
Status: resolved
Blocked by: 04, 05

## Interim decisions (grill round 1, 2026-08-14)

- **Dark mode only in v1.** No light theme, no toggle. Tokens still structured so a light theme can be added later.
- **Home header**: wordmark left, magnifier + settings icons right; category chips row below; search expands in-place over the chips row.
- **Create button**: FAB, bottom-right thumb zone, 56px.
- **States**: home empty = 2–3 tappable starter suggestions; detail with zero Entries = "never logged" + primary log button; mutation failure = toast with retry; offline with empty cache = full-screen state; outbox non-empty = small pending chip in header.
- **Direction (A/B/C) NOT yet picked** — user wants a 3-way visual comparison first. Asset: [three-direction design prompt](../assets/06-three-direction-design-prompt.md), to be run through Claude design externally; direction resolves on the user's reaction.

## Question

Commit to a non-generic visual direction using the candidates from the UI direction reference research: pick the direction, settle type scale, palette + dark-mode tokens (incl. urgency accent colors), motion/animation language, empty states, error states, and per-screen wireframe decisions for the screens in `docs/design.md` — including the surfaces the Feature re-scope grill pulled in: expanding home search, observed-interval line + threshold-suggestion hint on tracker detail, per-Variant threshold in the variant editor. Load `design-quality` + `interface-kit` skills. Output: updated `docs/design.md` with the committed direction.

## Answer

**Direction committed 2026-08-15: "ledger × catppuccin mocha"** — the user ran the 3-direction comparison through Claude design externally and picked frames **3a (home)** and **3b (list)**, an evolution of the "Warm Ledger" candidate onto the Catppuccin Mocha palette.

- **Design reference**: claude.ai/design project `80c06c41-c051-443b-b504-f0b4a20280a1`, file "Lapse Directions.dc.html". Frames 3a/3b extracted verbatim to [assets/06-chosen-direction-ledger-mocha.html](../assets/06-chosen-direction-ledger-mocha.html) — the canonical implementation reference.
- **Palette**: Catppuccin Mocha subset — base `#1e1e2e`, surface0 `#313244`, surface1 `#45475a`, text `#cdd6f4`; urgency accents red `#f38ba8` (overdue), peach `#fab387` (due-soon), green `#a6e3a1` (fresh); lavender `#b4befe` primary (FAB, active chip). Full token table in `docs/design.md`.
- **Type**: Source Serif 4 for names/wordmark/section labels (italic labels), IBM Plex Mono for all numbers + meta. Noise texture overlay at 0.045 opacity.
- **IA change vs interim decisions**: home is a **digest** (slipping cards + quick-log grid + "all items" footer), the full sorted list is its own tab with category chips. **Bottom tab bar** (home · list · center + FAB · activity · settings) supersedes "FAB bottom-right" and "settings icon in header". Header keeps magnifier + sliders.
- **Urgency treatment**: 3px left accent bar on home cards; 24px × 2px underline bar under the day-count on list rows; `never` = em-dash + dotted underline + de-emphasised italic name; thresholdless = plain count, no bar.
- **Motion**: gentle spring settle; undo toast slides in like a slip of paper.
- **Not designed yet**: activity + settings screens (roughly implied by the tab bar) — follow direction tokens; detail screens (tracker detail, sheets, editors) render in the same language. Reactions round covered by the Home screen prototype ticket.
- `docs/design.md` rewritten with the committed direction (token table, type scale, shape/component specs, screen changes, motion).
