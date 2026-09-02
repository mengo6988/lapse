# 05 — Entries and history endpoints

**What to build:** An API client can log an Entry (safely replaying the same one), edit or delete it, and page back through a Tracker's history newest-first — the server behaviors the outbox and the history screen both depend on.

**Blocked by:** 03 (Schema, migrations, and category seed).

**Status:** resolved

- [x] Create an Entry against a Tracker and optionally a Variant, with a client-supplied UUIDv7 id accepted; replaying a duplicate id returns 200 with the existing row instead of creating a second Entry
- [x] `occurredAt` defaults to now when absent, and a future `occurredAt` is clamped to server-now rather than rejected (a skewed client clock must degrade to an editable timestamp, never a dead letter)
- [x] Archived Trackers accept Entries, since the outbox may replay one queued before archiving
- [x] Edit and delete an Entry
- [x] History is cursor-paginated (`?cursor=<entryId>&limit=50`), ordered by `occurredAt` descending with id descending as the tiebreak
- [x] Validation per spec: `durationMinutes` int 1–1440 nullable, `note` at most 500 chars, `occurredAt` a valid ISO timestamp
- [x] Integration tests cover idempotent replay, the future clamp, the archived-Tracker path, and pagination across a page boundary with a duplicate `occurredAt`
