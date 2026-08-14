# Design prompt — lapse: three-direction home-screen comparison

> Paste everything below this line into Claude design.

---

Build **three complete mobile home-screen mockups** of the same app — one per visual direction described below — so I can compare them side by side and commit to one. Dark mode only. Same content, same layout skeleton, same sample data in all three; ONLY the visual language changes (type, color, texture, motion feel). Each direction should be a full ~390×844 phone-sized page, clearly labeled A / B / C (three separate pages or three phone frames, whichever presents best).

## The product

**lapse** — a single-user, mobile-first tracker that answers "when did I last do X?" (vacuum the house, check tyre pressure, descale the coffee machine). The home screen is a glanceable list sorted by urgency: glance for one second, see what's slipping, tap a row to log "I just did this". It is explicitly NOT a todo app or habit tracker — no checkboxes, no due dates, no streaks, no guilt. An overdue row is information, not a nag.

The elapsed-time figure ("34d ago") is the load-bearing element of every row. Urgency is communicated by a small color accent per row (dot / bracket / underline depending on direction) — never full-row color fills, never colored body text. The screen must never read as an alarm console even when several rows are overdue.

## Shared layout skeleton (identical in all three)

Top to bottom:

1. **Header**: wordmark "lapse" left; magnifier and settings icons right.
2. **Category chips row**: horizontal chips — all · house · car · health · personal ("all" active).
3. **The list**: flat full-width rows, one per item below. Each row: name (plus " · variant" suffix where given), a subline "last done … · every …", the urgency accent, and the big elapsed-time figure. Whole row is the tap target.
4. **FAB**: bottom-right floating "+" button, 56px.

## Sample data (identical in all three, this exact order)

| Name | Last done | Threshold | State |
|---|---|---|---|
| descale coffee machine | never | every 90d | never-logged (distinct "unstarted" look) |
| change hvac filter | 74d ago | every 60d | overdue |
| tyre pressure · volvo | 34d ago | every 30d | overdue |
| tyre pressure · crv | 6d ago | every 7d | due-soon |
| clean litter box | 9h ago | every 1d | fresh |
| water plants | 1d ago | every 3d | fresh |
| vacuum house | 2d ago | every 7d | fresh |
| call grandma | never | — | neutral (no threshold, quiet) |
| haircut | 18d ago | — | neutral (no threshold, quiet) |

Urgency states: **overdue** = red accent, **due-soon** = amber accent, **fresh** = green accent, **never** = distinct unstarted treatment (no red — it's not guilt), **neutral** = no urgency color at all. In dark mode keep accent chroma restrained (roughly 20–35% less saturated than you'd use on white) so the screen stays calm; contrast-check the small accent marks, not just the text.

## Direction A — "Departure Board"

Split-flap airport board / Flighty / Teenage Engineering lineage. The original glanceable status list.

- **Type**: monospaced or tabular-figure face (JetBrains Mono, IBM Plex Mono class) for every number — the "34d" figure is big, the hero of each row. Labels in a condensed grotesque, lowercase (IBM Plex Sans Condensed, Archivo Narrow class).
- **Color**: cool near-black background (e.g. oklch(0.16 0.01 250)), cool off-white text, zero warmth. Urgency = small square dot or bracket beside the number only.
- **Feel**: mechanical, information-dense, airport-signage grammar — the status color is the only variable element in an otherwise monochrome row. Hairline row dividers. No rounded-corner softness, no shadows, no gradients.
- **Motion note** (static mockup is fine): changes would digit-roll like a split-flap; nothing springs.

## Direction B — "Studio Mono"

Braun / Dieter Rams austerity, Bear-app restraint.

- **Type**: thin geometric/humanist sans, all lowercase (Jost, Outfit, Schibsted Grotesk class, light weights). The tracker NAME is the hero, set big; the "34d ago" line sits quieter beneath it.
- **Color**: true-black / warm-white duochrome. The per-row urgency accent is the ONLY saturated thing on the entire screen, further desaturated for dark. Accent form: minimal dot.
- **Feel**: product-design object, almost no ornament — restraint alone reads as distinctive. Generous whitespace between rows, no dividers, no shadows, no gradients.
- **Motion note**: 150–200ms ease-out fades only.

## Direction C — "Warm Ledger"

Editorial print / Moleskine Timepage lineage — a paper ledger you keep, not a dashboard.

- **Type**: serif or slab for tracker names (Source Serif 4, Zilla Slab, Lora class) — the genuinely non-generic choice; tabular sans or mono for the numeric subline.
- **Color**: warm dark charcoal-brown background (e.g. oklch(0.18 0.02 60)), warm cream text. Urgency accents as short colored underlines or thin side-bars that read like ink marginalia.
- **Feel**: warm, bookish, quietly premium. Subtle paper grain or texture welcome. Soft edges allowed where A forbids them.
- **Motion note**: gentle spring settle; an undo toast would slide in like a slip of paper.

## Guardrails (all three)

- Dark mode only. No light variant.
- No generic component-library look: no default card grids, no stock shadcn/Tailwind template feel, no gradient-blob decoration. Each direction must be committed fully, not blended.
- Backgrounds and text stay on the neutral scale; red/amber/green touch ONLY the small accent marks.
- Numbers use tabular figures everywhere so digits don't jitter.
- Body text ≥ 14px; the row tap target ≥ 56px tall; keep it one-hand thumb-friendly.
- All three pages must present the SAME data and skeleton — this is a controlled comparison of visual language only.
