# 03 — Schema, migrations, and category seed

**What to build:** A fresh data directory boots into a fully-shaped database: the four tables exist with their indexes and delete semantics, and the four starter Categories are present exactly once.

**Blocked by:** 01 (Walking skeleton).

**Status:** resolved

- [x] Drizzle schema for `categories`, `trackers`, `variants`, `entries` matching the spec data model, with UUIDv7 text primary keys and ISO-8601 UTC text timestamps carrying milliseconds
- [x] Spec indexes present: `entries(trackerId, occurredAt)`, `entries(variantId)`, `variants(trackerId)`, `trackers(categoryId)`
- [x] Delete semantics enforced at the schema level: Tracker hard delete cascades its Variants and Entries; Category delete nulls `trackers.categoryId`; Variant delete is a soft delete via `deletedAt`, so Entries keep their `variantId` and history keeps its label
- [x] Migration runs on boot against an empty data dir and seeds house / car / health / personal, each with a color
- [x] Integration test proves the seed is idempotent across two boots against the same database, and that a soft-deleted Variant's Entries survive with their label
