# 07 — Entry edit and delete writes onto the interface

**What to build:** Editing and deleting an Entry from the Tracker detail history move onto the shared write interface. These are the two writes that touch the paginated entry-history cache rather than the bootstrap payload, and that mark the bootstrap stale rather than grafting — so this ticket is where the interface's second success kind earns its place. Both actions behave exactly as they do now.

**Blocked by:** 05 — the write interface must exist first.

**Status:** resolved

An edited or deleted Entry may have been a Tracker's or Variant's latest, and that field is server-authoritative — so both writes keep invalidating the bootstrap rather than recomputing the new latest on the client.

- [x] Editing an Entry goes through the shared write interface, updating the already-loaded history pages in place
- [x] Deleting an Entry goes through the shared write interface, removing it from the already-loaded history pages
- [x] Both still mark the bootstrap stale, so a changed latest Entry is refetched rather than guessed
- [x] Neither forces a refetch of the whole scrolled-through history
- [x] Per-field validation errors on an edit still render next to the field that caused them
- [x] The two bespoke hooks and their test files are deleted
- [x] Tracker detail screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `24bb969` — refactor: Entry edit and delete writes onto the write interface.
