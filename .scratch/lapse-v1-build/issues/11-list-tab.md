# 11 — List tab

**What to build:** The full ledger: every active row in spec sort order, filterable by Category chip and searchable by name, with urgency legible from the accent bars alone.

**Blocked by:** 07 (Pure domain modules), 08 (Query layer with persisted cache), 09 (Design tokens and app shell).

**Status:** resolved

- [x] Rows follow the spec sort order and each shows its urgency underline bar, with distinct treatments for `never` and `neutral` rows
- [x] Category chips filter the list without changing the sort order within the filter
- [x] Search expands to an input in place and filters Tracker and Variant names client-side, showing `no matches` when empty
- [x] Arriving from the home magnifier opens the tab with search already focused
- [x] Archived Trackers and soft-deleted Variants never appear

The visual mock shows a same-day row as "9h", but the landed domain layer only buckets whole device-local days, so every count renders as `Nd` or an em-dash. Changing that means adding an hour-granularity function to the domain modules, which is a design call rather than a list-tab call.

Category filter and search compose rather than replacing each other, matching the prototype's behaviour. A category filter that empties the list reuses the generic empty string; `no matches` is reserved for a non-blank search.
