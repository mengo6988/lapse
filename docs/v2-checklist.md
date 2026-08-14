# Lapse — v2+ Checklist

Explicitly cut from v1 (grilling 2026-08-14). Explore when v1 ships. Roughly priority-ordered.

- [ ] **Notifications via ntfy (v1.1)** — backend cron checks ratios, POSTs to ntfy topic when a Tracker crosses Overdue. Per-tracker toggle, quiet hours. Chosen over Web Push (iOS subscriptions silently vanish).
- [ ] **Stats / insights** — "you actually do this every ~40d", average intervals, history charts. Full Entry history already collected in v1.
- [ ] **Threshold suggestions** — after N entries, suggest setting/adjusting Threshold to the observed real interval.
- [ ] **NFC tags** (Donetick pattern) — sticker on appliance, phone tap logs Entry without opening app.
- [ ] **Home-screen widget** — DoneAgo pattern; note: not possible from a PWA on iOS, would need a native wrapper or Shortcuts-based workaround.
- [ ] **Per-Variant Threshold override** — volvo monthly, crv weekly.
- [ ] **Usage-based intervals** — remind by odometer/usage, not just time (LubeLogger/Drivvo pattern).
- [ ] **CSV/JSON export UI** — v1 backup = copy the SQLite file.
- [ ] **Multi-user / household** — shared list, "who did it last". Breaks ADR-0003; only if a second human actually wants in.
- [ ] Full local-first sync engine — footnote only; revisit if multi-device concurrent editing produces real conflicts (ADR-0002).
