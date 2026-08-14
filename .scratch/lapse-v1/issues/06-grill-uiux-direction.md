# UI/UX direction grill

Type: grilling
Status: claimed — waiting on user's external 3-direction design comparison (see Interim decisions + asset link below); resolves when user reports their pick
Blocked by: 04, 05

## Interim decisions (grill round 1, 2026-08-14)

- **Dark mode only in v1.** No light theme, no toggle. Tokens still structured so a light theme can be added later.
- **Home header**: wordmark left, magnifier + settings icons right; category chips row below; search expands in-place over the chips row.
- **Create button**: FAB, bottom-right thumb zone, 56px.
- **States**: home empty = 2–3 tappable starter suggestions; detail with zero Entries = "never logged" + primary log button; mutation failure = toast with retry; offline with empty cache = full-screen state; outbox non-empty = small pending chip in header.
- **Direction (A/B/C) NOT yet picked** — user wants a 3-way visual comparison first. Asset: [three-direction design prompt](../assets/06-three-direction-design-prompt.md), to be run through Claude design externally; direction resolves on the user's reaction.

## Question

Commit to a non-generic visual direction using the candidates from the UI direction reference research: pick the direction, settle type scale, palette + dark-mode tokens (incl. urgency accent colors), motion/animation language, empty states, error states, and per-screen wireframe decisions for the screens in `docs/design.md` — including the surfaces the Feature re-scope grill pulled in: expanding home search, observed-interval line + threshold-suggestion hint on tracker detail, per-Variant threshold in the variant editor. Load `design-quality` + `interface-kit` skills. Output: updated `docs/design.md` with the committed direction.
