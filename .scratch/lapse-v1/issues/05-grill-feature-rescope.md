# Feature re-scope grill

Type: grilling
Status: resolved

## Question

Re-walk `docs/v2-checklist.md` plus any fresh ideas and decide, item by item, whether anything gets pulled into v1 (candidates: stats-lite, threshold suggestions, per-Variant threshold override, export UI, notifications). Each pulled feature graduates to its own decision ticket, since it reshapes the schema/API and UI/UX grills downstream. Output: confirmed v1 feature list; updates to `docs/spec.md` + `docs/v2-checklist.md` if changed.

## Answer

Resolved 2026-08-14, two grilling rounds with the user.

### Pulled into v1

1. **Observed-interval line** — tracker detail shows "actually every ~Nd": mean gap over the last 10 Entries (per-Variant when the row is a Variant), displayed only after ≥3 Entries (2 gaps minimum). No new endpoint or schema change — history is already fetched on the detail screen.
2. **Threshold suggestions** — on tracker detail only, when a Tracker has ≥3 Entries and the observed interval deviates more than 30% from the set Threshold: inline hint ("actually every ~40d — update threshold?") with one-tap accept. Thresholdless Trackers with ≥3 Entries get a gentler "log every ~40d? set threshold" hint, one tap sets it. Never on the home list, never a notification.
3. **Per-Variant Threshold override** — `variants.thresholdDays` nullable; null inherits the parent Tracker's Threshold. Edge cases confirmed: a thresholdless parent may have thresholded Variants (the Variant gets its own urgency; tracker-level state stays neutral); the row subtitle "every Yd" always shows the effective (own-or-inherited) value. Urgency ratio uses the effective Threshold. Set/clear lives in the variant edit UI (visual treatment → UI/UX direction grill).
4. **Home search** — magnifier icon in the home header, expands to an input; client-side filter over Tracker/Variant names. No schema/API impact.

No new tickets needed: mechanics were settled in-round; remaining detail is visual treatment (UI/UX direction grill) and column/validation shape (Schema & API grill), both already scoped to absorb it.

### Stays v2 (reconfirmed)

- **Export UI** (user kept it out despite the broken "copy the SQLite file" backup line — safe backup is server-side, settled in the Ops grill)
- **Notifications v1.1 (ntfy)** — door offered, declined; still the only sanctioned re-entry is a future re-scope
- **Stats/charts beyond the observed-interval line**, NFC tags, home-screen widget, usage-based intervals, multi-user, sync engine

### Docs updated

`docs/spec.md` (features 9–11, domain rules, `variants` schema, API notes) and `docs/v2-checklist.md` (pulled items removed, stats line narrowed, backup wording corrected).
