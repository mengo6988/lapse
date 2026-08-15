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
9. **Observed interval** — tracker detail shows "actually every ~Nd": mean gap over the last 10 Entries (per-Variant for Variant rows), shown only after ≥3 Entries.
10. **Threshold suggestion** — on tracker detail, when ≥3 Entries exist and the observed interval deviates >30% from the Threshold: inline hint ("actually every ~40d — update threshold?") with one-tap accept. Thresholdless Trackers with ≥3 Entries get a gentler "set threshold?" hint. Never on the home list, never a notification.
11. **Search** — magnifier icon in the header; on home it navigates to the List tab with search open, on list it expands to an input in place (prototype ticket 12). Client-side filter over Tracker/Variant names.

## Domain rules

- **Threshold optional.** Thresholdless Trackers never become Overdue; they're a pure logger (last haircut).
- **Variants have independent last-done state.** A Variant may override the parent's Threshold (`thresholdDays`, nullable — null inherits). A thresholdless parent may still have thresholded Variants: the Variant gets its own urgency, tracker-level state stays neutral. Urgency ratio and the "every Yd" subtitle always use the effective (own-or-inherited) value. On home, each Variant is its own row ("Tyre pressure · volvo"). A Tracker without Variants is one row.
- **Observed interval** = mean gap between consecutive Entries over the last 10 Entries, computed per-Variant for Variant rows; defined only once ≥3 Entries exist.
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
variants    id, trackerId, name, thresholdDays?, deletedAt?, createdAt
entries     id, trackerId, variantId?, occurredAt, durationMinutes?, note?, createdAt
```

- **IDs**: UUIDv7, text primary keys, all tables. Client may generate (required for outbox entries); server generates when absent.
- **Timestamps**: UTC ISO-8601 text with milliseconds. `createdAt` always server-stamped; `occurredAt` is the client-supplied event time (dual timestamps on entries).
- **Deletes**: Tracker hard-delete cascades variants + entries (archived-only, confirmed in UI). Category delete sets `trackers.categoryId` null. **Variant delete is a soft delete** (`deletedAt`): entries keep their `variantId` so history keeps its label; deleted variants excluded from bootstrap/home; no undelete UI in v1.
- **Variants added to a Tracker with existing Entries**: old entries stay tracker-level (`variantId` null); new variants start at "never".
- **Indexes**: `entries(trackerId, occurredAt)`, `entries(variantId)`, `variants(trackerId)`, `trackers(categoryId)`.

Full Entry history kept forever (enables v2 stats).

## API (REST, all under /api)

Server is dumb CRUD; client computes ratios and sort (ADR-0001).

```
POST   /auth/login                {password} → session cookie (LAPSE_PASSWORD required; rate-limited 10/15min per IP — ADR-0003 amendment)
GET    /health                    unauthenticated liveness (Docker HEALTHCHECK target)
GET    /bootstrap                 see payload below
POST   /trackers                  create (name, categoryId?, thresholdDays?, variants?)
PATCH  /trackers/:id              edit / archive (archivedAt) / unarchive
DELETE /trackers/:id              hard delete (archived only)
POST   /trackers/:id/variants     add variant (name, thresholdDays?)
PATCH  /variants/:id              rename / set or clear thresholdDays
DELETE /variants/:id              soft delete (deletedAt)
POST   /entries                   {id?, trackerId, variantId?, occurredAt?, durationMinutes?, note?} — occurredAt defaults now
GET    /trackers/:id/entries      history, cursor-paginated: ?cursor=<entryId>&limit=50, occurredAt desc (id desc tiebreak)
PATCH  /entries/:id
DELETE /entries/:id
CRUD   /categories
```

**Bootstrap payload** (one launch-time round trip, hydrates the query cache; archived trackers included with flag set, client filters; deleted variants excluded; observed-interval computes client-side from the history fetch, not here):

```
{ categories: [...],
  trackers: [{ id, name, categoryId, thresholdDays, archivedAt, createdAt,
               latestEntry,               // latest VARIANTLESS entry
               variants: [{ id, name, thresholdDays, latestEntry }] }] }
```

**Idempotency**: `POST /entries` accepts a client-generated UUIDv7 `id`; a duplicate id returns 200 with the existing row, so outbox replays are safe. Archived Trackers accept entries (outbox may replay an entry queued before archiving); the UI hides them regardless.

**Validation** (Zod via `@hono/zod-validator`, 400 with field errors): `name` trimmed 1–100 chars; `thresholdDays` int 1–3650, nullable; `durationMinutes` int 1–1440, nullable; `note` ≤ 500 chars; `occurredAt` valid ISO — a future value is **clamped to server-now** on ingest, not rejected (offline-lite grill: a skewed client clock must degrade to a slightly-wrong editable timestamp, never a dead-lettered log); `color` `#rrggbb`.

## Out of scope for v1

See `docs/v2-checklist.md`. Notably: notifications (v1.1 via ntfy), stats/charts beyond the observed-interval line, NFC, widgets, multi-user, export UI.
