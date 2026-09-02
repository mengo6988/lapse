# 03 — Home onto the shared row shape

**What to build:** Home is the fourth caller of the Tracker-to-row rule and the only one with its own row shape. This ticket retires that shape and puts Home on the shared flattener. The slipping section and the quick-log tiles look and behave exactly as they do now.

**Blocked by:** 02 — the flattener must exist first.

**Status:** resolved

Home's row fields are a subset of the shared shape, so this is a substitution rather than a redesign. The slipping and quick-log selectors keep their own rules — top three that are due-soon or overdue, six recency-ranked candidates excluding whatever the slipping section already shows — and only change the type they operate on.

- [x] Home's private row shape is retired; the home digest renders from the shared row shape
- [x] Home's row builder and its test file are deleted
- [x] The slipping selector and the quick-log selector operate on the shared shape, with their selection rules and limits unchanged
- [x] Slipping cards and quick-log tiles render the same name, Variant label, day count and subline as before
- [x] Tapping a slipping card or a quick-log tile still logs against the same Tracker or Variant
- [x] Home screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `0a6a6e2` — refactor: Home onto the shared row shape.
