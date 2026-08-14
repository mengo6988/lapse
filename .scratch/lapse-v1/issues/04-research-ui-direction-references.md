# UI direction reference research

Type: research
Status: resolved

## Question

Gather concrete visual references so the UI/UX direction grill picks from real candidates instead of adjectives. Working candidate is a "big-type list" aesthetic; anti-goal is generic component-library look. Deliver:

- 5–10 named references (real apps, products, design systems) with one line each on what to steal — type-driven list UIs, editorial/Braun-ish minimalism, mobile PWAs that feel native
- 2–3 packaged candidate directions (name + type scale + color approach + motion feel) for the grill to choose between
- Light+dark token approaches that keep urgency accent colors (red/amber/green) legible in both modes without alarm-screen feel
- Tap-to-log feedback motion patterns (row state change + undo toast) done well

## Answer

Resolved 2026-08-14 by research agent. Full findings below.

### 1. Named visual references

- **Flighty** — airport-signage color grammar (status color is the only variable element in an otherwise monochrome row), monospaced/tabular type for critical numbers so digits don't jitter, one-line-per-item density. Near-direct proof-of-concept for "when did I last do X" as a status list. [Breakdown](https://blakecrosley.com/guides/design/flighty) · [Behind the Design](https://developer.apple.com/news/?id=970ncww4)
- **Teenage Engineering** — thin-weight lowercase type, true-black + warm-white duochrome, zero rounded corners/shadows/gradients, color rationed to almost nothing. Restraint alone reads as distinctive. [Breakdown](https://blakecrosley.com/guides/design/teenage-engineering)
- **Tody** (existing anchor) — indicators of actual need rather than due-date guilt; dirtiness as a level, not a checkbox. Validates "not a todo app" at the data-model level. [todyapp.com](https://todyapp.com/)
- **Planta / The Plant Map** (non-obvious) — same domain shape (interval since last action, urgency drifts, one-tap log); ships a color-coded "needs water / can wait / needs attention" system — red/amber/green validated in a consumer app outside productivity. [Planta](https://getplanta.com/)
- **Moleskine Timepage** (non-obvious) — one accent color threaded through everything as antidote to component-library sameness; color *density* (not fill) communicating a scalar. [Case study](https://medium.com/@nadiahussain96/ux-ui-case-study-a9975c79e642)
- **Split-flap / Solari departure boards** (non-obvious, physical) — the original glanceable status list: one line per item, mechanical type, updates read as an event (the flip). Ancestor of the Flighty look. [Wikipedia](https://en.wikipedia.org/wiki/Split-flap_display)
- **CARROT Weather** — big numeral (72px, weight ~200) as sole hero element. Steal the type-scale confidence only, not the personality. [Breakdown](https://blakecrosley.com/guides/design/carrot-weather)
- **Copilot Money** — native-feel list rows with a quiet colored dot beside otherwise neutral rows; real component system, not a UI kit default. Closest commercial analog to "flat rows + one status dot". [Case study](https://mattstromawn.com/projects/copilotmoney/)
- **Streaks** (cautionary) — colored-ring-per-habit is exactly the generic-tracker look to avoid; but its "null day" anti-guilt mechanism is worth noting. [Review](https://thesweetsetup.com/apps/best-habit-tracking-app-ios/)
- **Bear** — custom typeface (Bear Sans) as the move that actually kills "shadcn feel" — a distinct type voice, not just a nicer system font. [Announcement](https://blog.bear.app/2023/08/learn-about-our-new-custom-font-bear-sans/)

### 2. Three candidate directions (for UI/UX direction grill to pick)

**A. "Departure Board"** — mono/tabular-figure face (JetBrains Mono / Berkeley Mono class) big on the "Nd ago" numeral; condensed grotesque lowercase for labels. Cool near-black (dark) / cool off-white (light), zero warmth; urgency color only as a small bracket/dot beside the number, never on type. Motion mechanical: digit-roll/fast crossfade, no springs. Draws from Flighty, split-flap boards, TE.

**B. "Studio Mono" (Braun/Rams austere)** — thin geometric/humanist sans, lowercase, *tracker name* is the hero (big), the "12d ago" line quieter. True-black/warm-white duochrome both modes; urgency accent is the only saturated thing on screen, further desaturated in dark. Motion minimal: 150–200ms ease-out fades, no bounce. Draws from TE, Braun, Bear.

**C. "Warm Ledger" (editorial)** — serif/slab for tracker names (the genuinely non-generic type choice), tabular sans/mono for numeric subline. Warm paper-cream light mode, warm dark-brown/charcoal dark mode; urgency accents as short colored underlines/side-bars reading like ink marginalia. Motion soft: gentle spring settle (response ~0.3, damping ~0.7), undo toast slides in like a slip of paper. Draws from Timepage, Bear, Copilot, print design.

Directions differ on all three axes (type / color / motion) — a real choice, not shades of one idea.

### 3. Light+dark token strategy for urgency accents

Core rule: **accent-on-neutral only** — backgrounds/text stay on the neutral scale in both modes; red/amber/green applied only to a small mark (dot, 3–4px bar, short underline), never a fill.

1. OKLCH with fixed hue, mode-varying L/C: red ≈ 25°, amber ≈ 70–80°, green ≈ 145–150° constant across modes; vary lightness/chroma per mode. [OKLCH for designers](https://uxdesign.cc/oklch-explained-for-designers-dc6af4433611)
2. Dark mode: drop chroma 20–35%, nudge lightness up — the single biggest lever against alarm-screen feel.
3. Radix-style 12-step scale but use only step 9 for the mark; never steps 1–3 as row backgrounds — enforces "accent as mark" at token level. [Radix docs](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
4. Material 3 corroborates: dark-theme accents shift into lighter/less-saturated tonal range. [M3 color roles](https://m3.material.io/styles/color/roles)
5. Neutrals never drift toward accent hues regardless of urgency.
6. Contrast-check the mark itself with APCA (small-mark sensitivity), not plain WCAG ratio on the row.

### 4. Tap-to-log motion patterns

- **Immediate press (0–150ms)**: scale ~0.96 compress, 80–120ms ease-out — visual stand-in for haptics (no haptic API in PWA).
- **State settle (150–350ms)**: "12d ago" crossfades (directions B/C, 150–200ms ease-out) or digit-rolls (direction A) to "just now"; spring option response ~0.3 / damping ~0.7 (Apple Music feel). No full-row color flash — the accent mark does the color work.
- **Undo toast**: Material snackbar conventions — slide+fade in 200–400ms ease-out, bottom-anchored, single "Undo" action, auto-dismiss ~4–5s, exit fade+slide-down 150–200ms; one toast max, second log replaces/extends. Gmail Undo Send = canonical (fire immediately, hold execution behind reversible window). [M2 snackbars](https://m2.material.io/components/snackbars)
- **Confirmation feel**: iOS Mail/Reminders swipe-complete — compress-and-settle tightly timed to tap reads as haptic to the eye.
