# Branding grill

Type: grilling
Status: resolved
Blocked by: 06

## Question

Settle app identity within the committed visual direction: app icon (PWA manifest icons, maskable), name treatment ("lapse" casing/wordmark), and copy tone (the "logged ✓" voice — confirmation strings, empty states, error copy). Output: branding notes in `docs/design.md` + manifest icon spec.

## Answer

Resolved 2026-08-15, one grill round of 4 questions + one revision round on naming:

1. **Name treatment** (revised after push-back): split by surface — lowercase "lapse" on all product surfaces (wordmark, in-app copy), capitalized "Lapse" on OS surfaces only (manifest `name`/`short_name`, home-screen label). All-lowercase-everywhere and capitalized-everywhere both rejected.
2. **Icon concept**: serif lowercase "l" on `base #1e1e2e` with a short lavender underline bar — wordmark letter + urgency-bar signature. Full-bleed, no transparency.
3. **Icon production**: hand-authored SVG in repo (text-as-path), one-off sharp script generates committed PNGs: 192, 512, 512-maskable (~66% safe zone), 180 apple-touch. Manifest `background_color`/`theme_color` = `#1e1e2e`.
4. **Copy tone**: terse lowercase dry — no exclamations, no guilt language, em-dash separators, past-tense confirmations; canonical-strings table added to design.md (log toast `logged ✓` + undo, empty states, offline errors, login) so copy extends there, never ad-hoc.

**Docs updated**: `docs/design.md` (new § Branding: name treatment, icon spec, copy tone + strings table).
