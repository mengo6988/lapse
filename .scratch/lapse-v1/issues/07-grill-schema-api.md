# Schema & API review grill

Type: grilling
Status: resolved
Blocked by: 01, 05

## Question

Walk the data model + REST API in `docs/spec.md` before the first migration, folding in stack-validation findings and any features the re-scope grill pulled in. Settle: Drizzle column types + indexes, cascade rules, pagination shape for `GET /trackers/:id/entries`, the variantless-entries edge case, `/bootstrap` payload shape, and validation rules per endpoint. Output: updated spec section, ready to write as the first Drizzle schema.

## Answer

Resolved 2026-08-15, two grilling rounds with the user. All detail folded into `docs/spec.md` (data model + API sections rewritten); gist:

1. **IDs**: UUIDv7 text primary keys on all four tables. One convention; time-sortable; client-generatable.
2. **Timestamps**: UTC ISO-8601 text with milliseconds. Server stamps `createdAt`; entries keep dual timestamps (client `occurredAt`, server `createdAt`).
3. **Delete semantics**: tracker hard-delete cascades variants + entries (unchanged). Category delete sets `trackers.categoryId` null (unchanged). **Variant delete = soft delete** — new `variants.deletedAt` column; entries keep their `variantId` so history shows "· volvo" forever; deleted variants filtered from bootstrap/home; no undelete UI in v1. History fidelity is the product — chosen over set-null after explicit comparison.
4. **Variants-added-later edge**: existing entries stay tracker-level (`variantId` null); new variants start at "never"; no reassignment magic (manual entry edit if the user cares).
5. **Pagination**: cursor-based — `GET /trackers/:id/entries?cursor=<entryId>&limit=50`, ordered `occurredAt` desc with id desc tiebreak; stable under mid-scroll inserts.
6. **Bootstrap**: single `GET /api/bootstrap` on launch — categories, trackers (archived included, flag set), nested non-deleted variants, latest entry per variant + latest variantless entry per tracker. Hydrates the query cache; observed-interval computes client-side from the detail-screen history fetch, NOT bootstrap.
7. **Validation** (Zod via `@hono/zod-validator`, 400 with field errors): name trimmed 1–100; thresholdDays int 1–3650 nullable; durationMinutes int 1–1440 nullable; note ≤500; occurredAt valid ISO ≤ now+5min skew; color `#rrggbb`; `POST /entries` id optional client UUIDv7, server generates when absent, duplicate id returns 200 with the existing row (idempotent outbox replay).
8. **Archived trackers accept entries** — outbox may replay an entry queued before archiving; rejecting loses data. UI hides archived rows regardless.
9. **Indexes**: `entries(trackerId, occurredAt)`, `entries(variantId)`, `variants(trackerId)`, `trackers(categoryId)`. **`GET /api/health`** added for the Docker HEALTHCHECK (stack research).
