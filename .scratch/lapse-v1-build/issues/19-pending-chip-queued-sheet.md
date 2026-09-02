# 19 — Pending chip and queued sheet

**What to build:** When logs are waiting to reach the server, the app says so in one glance and gives a way to deal with them — without ever blocking a log.

**Blocked by:** 17 (Offline outbox).

**Status:** resolved

- [x] The home header shows a pending chip while the outbox is non-empty (for example `2 queued`), rendered in the failure accent when an item has dead-lettered
- [x] Tapping the chip opens a sheet listing pending and dead-lettered Entries with their Tracker or Variant label and intended time
- [x] The sheet offers retry-all and per-entry discard
- [x] The chip disappears as soon as the queue drains, with no manual dismissal needed

## Post-agent integration notes

Built by a fenced parallel agent alongside ticket 17, against the pre-written `outboxStore.ts` seam, so it needed nothing from the engine lane and the two never touched the same file.

One defect found by reading the implementation: **retry-all was disabled unless something had dead-lettered.** That kills the affordance in exactly the situation it is most wanted — a queue of waiting writes and a user who just got their signal back. `retryAllOutboxItems` commits either way, and that store emit is what wakes the drain, so the button now always means "try now".

Decisions worth remembering:

- **The chip renders in the shared `Header` on every tab**, not home only. `docs/design.md`'s "home header" predates the tab bar; a queued write is app-wide state, and hiding "your logs haven't landed" on four screens out of five is worse than showing it on all of them. Recorded in `docs/design.md` § Feel.
- **A queued delete shows as `removing an entry`** — the item carries only the Entry id, with no Tracker or Variant to name. Widening `OutboxItem` to carry them would fix it; not worth it for an item that only exists when an undo's DELETE failed against an Entry the server already had.
- Six new user-facing strings added to `docs/design.md`'s canonical strings table; two older ones retired there by ticket 17.
