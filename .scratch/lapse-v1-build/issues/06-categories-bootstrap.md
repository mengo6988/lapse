# 06 — Categories CRUD and bootstrap payload

**What to build:** The client can fetch everything it needs to render the app in one launch-time round trip, and can manage Categories.

**Blocked by:** 03 (Schema, migrations, and category seed).

**Status:** resolved

- [x] Categories create / read / update / delete, with `color` validated as `#rrggbb`; deleting a Category leaves its Trackers uncategorised
- [x] The bootstrap endpoint returns exactly the spec payload shape: categories, plus trackers carrying their fields, their latest variantless Entry, and their variants each with a latest Entry
- [x] Archived Trackers are included with `archivedAt` set, so the client can filter; soft-deleted Variants are excluded
- [x] Observed interval is deliberately not computed here — it is a client concern over the history fetch
- [x] Integration tests cover the payload shape, archived inclusion, deleted-Variant exclusion, and Category deletion nulling the Tracker reference
