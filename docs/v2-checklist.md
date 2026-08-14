# Lapse — v2+ Checklist

Explicitly cut from v1 (grilling 2026-08-14). Explore when v1 ships. Roughly priority-ordered.

- [ ] **Notifications via ntfy (v1.1)** — backend cron checks ratios, POSTs to ntfy topic when a Tracker crosses Overdue. Per-tracker toggle, quiet hours. Chosen over Web Push (iOS subscriptions silently vanish).
- [ ] **Stats / insights (charts)** — history charts, deeper aggregates. v1 now ships the observed-interval line + threshold suggestions (re-scope 2026-08-14); this item is what's left beyond that.
- [ ] **NFC tags** (Donetick pattern) — sticker on appliance, phone tap logs Entry without opening app.
- [ ] **Home-screen widget** — DoneAgo pattern; note: not possible from a PWA on iOS, would need a native wrapper or Shortcuts-based workaround.
- [ ] **Usage-based intervals** — remind by odometer/usage, not just time (LubeLogger/Drivvo pattern).
- [ ] **CSV/JSON export UI** — v1 backup is server-side (Ops grill: Litestream / `VACUUM INTO`; never copy the live WAL db).
- [ ] **Multi-user / household** — shared list, "who did it last". Breaks ADR-0003; only if a second human actually wants in.
- [ ] Full local-first sync engine — footnote only; revisit if multi-device concurrent editing produces real conflicts (ADR-0002).
