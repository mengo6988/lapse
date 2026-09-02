# 04 — One owner for the bootstrap cache

**What to build:** Four modules in four feature directories currently perform immutable surgery on the same cached bootstrap payload. After this ticket one module owns every write to it, and callers ask for a domain change by name rather than describing cache mechanics. Every screen updates after a write exactly as it does today, with no refetch where there is none now.

**Blocked by:** None — can start immediately.

**Status:** resolved

The merged module covers: add and patch a Tracker, add, patch and remove a Variant, add, patch and remove a Category, remove a Tracker on hard delete, and set a Tracker's or Variant's latest Entry.

The cross-entity rule travels with it: deleting a Category also clears the Category reference on every Tracker that pointed at it, mirroring what the server does.

The paginated entry-history cache stays where it is — a different query with a different shape.

- [x] One module beside the bootstrap query owns every write to the cached bootstrap payload
- [x] Its interface names domain changes, not cache mechanics
- [x] The mutation-response wire shapes returned by the Tracker and Variant write routes move with the module that grafts them
- [x] Deleting a Category still clears the Category reference on its Trackers in the cache, with no full refetch
- [x] The optimistic latest-Entry read and write used by tap-to-log and its undo live in this module
- [x] The four scattered cache modules and their test files are deleted; the paginated entry-history cache module is untouched
- [x] The merged module has one test file carrying every case the four retired files covered
- [x] All screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `ff8eada` — refactor: one owner for the bootstrap cache.
