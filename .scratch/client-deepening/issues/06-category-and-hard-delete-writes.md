# 06 — Category and hard-delete writes onto the interface

**What to build:** The remaining bootstrap-grafting writes move onto the shared write interface: adding, renaming and deleting a Category from Settings, and hard-deleting an archived Tracker. All four behave exactly as they do now, including the rule that deleting a Category leaves its Trackers uncategorised without a refetch.

**Blocked by:** 05 — the write interface must exist first.

**Status:** resolved

- [x] Creating, renaming and deleting a Category go through the shared write interface
- [x] Hard-deleting an archived Tracker goes through the shared write interface
- [x] Deleting a Category still clears the Category chip from every Tracker that used it, with no full refetch
- [x] Hard delete still surfaces the server's rejection when the Tracker is not archived
- [x] The four bespoke hooks and their test files are deleted
- [x] Settings and Archived screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `e4376f2` — refactor: Category and hard-delete writes onto the write interface.
