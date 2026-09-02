# 10 — Home digest

**What to build:** Opening the app answers "what's slipping?" at a glance: the three most urgent rows with their accents and last-done lines, quick-log tiles below, and a footer into the full list.

**Blocked by:** 07 (Pure domain modules), 08 (Query layer with persisted cache), 09 (Design tokens and app shell).

**Status:** resolved

- [x] The slipping section shows the top three rows by urgency, each with its accent bar and a "last done Xd ago · every Yd" line using the effective Threshold
- [x] Quick-log tiles and the all-items footer render per the prototype (the tap behavior itself lands in ticket 12)
- [x] The `nothing slipping` empty state appears when nothing is due-soon or overdue
- [x] The header magnifier navigates to the list tab with search open — search never overlays the digest
- [x] Variants render as their own rows, labeled with parent and Variant name

Two places where the ticket text was thinner than the design: the slipping subline follows `docs/design.md` and the prototype (`every Yd · Nd over`), not the ticket's `last done Xd ago · every Yd`, which is the list row format. And quick-log selection falls back to pure recency, because the bootstrap payload carries no frequency counts — design.md asks for "frequently/recently logged" and only the second half is computable from what the client has.

Tap is inert by design: `SlippingCard` and `QuickLogTile` take an optional `onTap`, forwarded by their sections, so ticket 12 supplies a handler without restructuring anything.
