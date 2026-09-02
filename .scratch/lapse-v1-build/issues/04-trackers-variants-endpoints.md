# 04 — Trackers and Variants endpoints

**What to build:** An API client can create a Tracker (optionally with Category, Threshold, and inline Variants), edit it, archive and unarchive it, hard-delete it once archived, and manage its Variants including per-Variant Threshold overrides.

**Blocked by:** 03 (Schema, migrations, and category seed).

**Status:** resolved

- [x] Create a Tracker with optional `categoryId`, `thresholdDays`, and inline variants
- [x] Edit, archive (set `archivedAt`), and unarchive a Tracker
- [x] Hard-delete a Tracker only when it is archived, cascading Variants and Entries; an unarchived Tracker is refused
- [x] Add a Variant, rename it, set or clear its `thresholdDays` (null means inherit the parent), and soft-delete it
- [x] Zod validation per spec (`name` trimmed 1–100 chars, `thresholdDays` int 1–3650 nullable) returns 400 with field errors
- [x] Integration tests with `app.request()` and `:memory:` SQLite, migrations in suite setup and a fresh database per test file, covering happy paths, validation errors, the hard-delete-on-unarchived refusal, and soft-deleted Variants disappearing from reads
