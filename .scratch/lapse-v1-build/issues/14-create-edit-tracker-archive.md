# 14 — Create and edit Tracker, archive

**What to build:** Adding a Tracker costs one field: type a name, done. Everything else — Category, Threshold, Variants — is available but out of the way. Editing reaches the same options, plus archive.

**Blocked by:** 04 (Trackers and Variants endpoints), 09 (Design tokens and app shell).

**Status:** resolved

- [x] The FAB opens a name-first add flow where typing a name and confirming is sufficient to create a Tracker
- [x] Category, Threshold presets, and Variants are collapsed options in the same flow, not required steps
- [x] Edit renames, changes Threshold and Category, and manages Variants: add, rename, set or clear a per-Variant Threshold override, soft-delete
- [x] Archive hides the Tracker from home and list while keeping its history intact
- [x] Validation errors from the server surface next to the field that caused them, in the copy voice
