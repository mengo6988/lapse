# Lapse — Product Spec (v1)

> Vocabulary per `CONTEXT.md`: Tracker / Variant / Entry / Threshold / Category / Overdue / Archive.
> Decisions settled in grilling session 2026-08-14. Tech details: `docs/tech-stack.md`. UX: `docs/design.md`.

## What it is

Single-user, self-hosted, mobile-first webapp answering "when did I last do X?". Core loop: glance at an overdue-sorted list, tap once to log "I just did this". Explicitly NOT a todo app, habit tracker (no streaks), or calendar.

Competitive gap (researched 2026-08-14): ~7 thin solo-dev iOS "days since" apps exist, none dominant; self-hosted options (Donetick, Grocy, Homebox) are dense general task managers. No mobile-first-minimal self-hosted "last done" tracker exists.

## Features (v1)

1. **Create Tracker** — cheapest possible flow: type name, done. Optional: Category, Threshold, Variants.
2. **One-tap log** — tap a row → Entry created at current time, instant optimistic feedback.
3. **Detailed log** — long-press a row → sheet: time (chips: now / 1h ago / yesterday / pick), optional duration, optional note. One sheet handles backdating + duration + note.
4. **Read model** — home list sorted by urgency (see Sorting), Category filter chips, per-row "last done Xd ago · every Yd".
5. **History** — tracker detail screen lists all Entries; each editable (time, duration, note) and deletable.
6. **Edit Tracker** — rename, change Threshold, manage Variants, change Category, Archive.
7. **Archive** — hides from home, keeps history. Hard delete only from archived view, with confirm.
8. **Offline-lite** — app shell opens without network; log-taps queue in an outbox and replay when online (see ADR-0002).

## Domain rules

- **Threshold optional.** Thresholdless Trackers never become Overdue; they're a pure logger (last haircut).
- **Variants have independent last-done state** and share the parent's Threshold. On home, each Variant is its own row ("Tyre pressure · volvo"). A Tracker without Variants is one row.
- **Entries** belong to a Tracker, optionally to a Variant. A Variant's last-done counts only Entries with that Variant; tracker-level (variantless) Entries show in history but don't reset any Variant. (Edge: adding Variants to a Tracker that already has Entries.)
- **Duration** on an Entry is optional and informational (run took 40m). It does not affect Overdue math.
- **Urgency ratio** = days since last Entry ÷ Threshold days. States:
  - `never` — thresholded, zero Entries
  - `fresh` — ratio < 0.8
  - `due-soon` — 0.8 ≤ ratio < 1
  - `overdue` — ratio ≥ 1
  - `neutral` — no Threshold
- **Timestamps** stored UTC (ISO 8601), displayed and day-bucketed in device-local time.

## Sorting (home list)

1. Thresholded, never logged — top, labeled "never".
2. Thresholded with Entries — descending ratio (8d on a 7d Threshold ranks below 60d on a 30d one).
3. Thresholdless — below all thresholded rows: never-logged first, then longest-since-logged.

Category chips filter the list; sort order unchanged within the filter.

## Categories

Seeded on first run: house, car, health, personal (each with a color). User can add/rename/recolor/delete. Category on a Tracker is optional. Deleting a Category leaves its Trackers uncategorised.

## Data model (SQLite)

```
categories  id, name, color, createdAt
trackers    id, name, categoryId?, thresholdDays?, archivedAt?, createdAt
variants    id, trackerId, name, createdAt
entries     id, trackerId, variantId?, occurredAt, durationMinutes?, note?, createdAt
```

Full Entry history kept forever (enables v2 stats). Hard delete of a Tracker cascades to variants + entries.

## API (REST, all under /api)

Server is dumb CRUD; client computes ratios and sort (ADR-0001).

```
POST   /auth/login                {password} → session cookie (skip entirely if LAPSE_PASSWORD unset)
GET    /bootstrap                 categories + trackers + variants + latest entry per tracker/variant
POST   /trackers                  create (name, categoryId?, thresholdDays?, variants?)
PATCH  /trackers/:id              edit / archive (archivedAt) / unarchive
DELETE /trackers/:id              hard delete (archived only)
POST   /trackers/:id/variants     add variant
PATCH  /variants/:id              rename
DELETE /variants/:id
POST   /entries                   {trackerId, variantId?, occurredAt?, durationMinutes?, note?} — occurredAt defaults now
GET    /trackers/:id/entries      history, newest first, paginated
PATCH  /entries/:id
DELETE /entries/:id
CRUD   /categories
```

`POST /entries` accepts a client-generated `id` (uuid) so outbox replays are idempotent.

## Out of scope for v1

See `docs/v2-checklist.md`. Notably: notifications (v1.1 via ntfy), stats, NFC, widgets, multi-user, export UI, per-Variant Threshold override.
