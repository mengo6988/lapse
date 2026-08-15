# Home screen prototype

Type: prototype
Status: resolved
Blocked by: 06

## Question

Build a throwaway high-fidelity prototype of the Home screen (list rows with urgency accents, category chips, tap-to-log + undo toast) in the committed visual direction, as an artifact to react to before real frontend work. Not production code. Output: prototype linked from this ticket; reactions feed final `docs/design.md` tweaks.

## Asset

[assets/12-home-prototype.html](../assets/12-home-prototype.html) — interactive single-file prototype (open in any browser; phone-sized frame on desktop, full-screen on mobile). Covers: home digest (slipping cards, quick-log tiles, all-items footer), list tab (category chips, search, urgency underline bars, spec sort order), tap-to-log with fresh-state settle + `logged ✓` undo toast (5s window, re-sort deferred until it expires), long-press log sheet (time/duration/note chips), tab bar with FAB, `nothing slipping` / `no matches` empty states. Activity/settings are labeled stubs (fog). Excluded: pending-offline chip, create-tracker flow, entry history.

## Answer

Resolved 2026-08-15. Prototype built, verified in-browser, and accepted by the user with all four open behaviors confirmed as prototyped:

1. **Undo-window choreography**: a logged card stays in place (green bar, count "now") for the 5s undo window; on toast expiry the digest/list re-sorts with a gentle fade and the next most-urgent card takes the slot. Never an instant jump.
2. **Search routing**: the home magnifier navigates to the List tab with search open; search never overlays the digest. On list, it expands in place.
3. **Header simplification**: the sliders icon is dropped from the header — it duplicated the tab bar settings slot and the list filter chips. Header keeps the magnifier only.
4. **Long-press threshold**: 450ms to open the log sheet; log settle ≈340ms spring; `prefers-reduced-motion` collapses all motion.

**Docs updated**: `docs/design.md` (prototype reference in the header note; header/nav sliders removal; home tap choreography + search routing; list freeze-then-resort; motion timings), `docs/spec.md` (feature 11 search wording).

Activity + settings layouts stayed stubs by design — that fog graduates into the Build handoff grill (13), which decides where their design pass happens (expected: in-build, extending the committed tokens).
