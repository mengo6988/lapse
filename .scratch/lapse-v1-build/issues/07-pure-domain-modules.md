# 07 — Pure domain modules

**What to build:** The domain logic the whole client reads from — urgency, sort order, effective Threshold, observed interval, Threshold suggestion — as pure functions with the unit tests that carry the client coverage threshold. No UI, no fetching.

**Blocked by:** 01 (Walking skeleton). Extends the urgency module started as the first RED test there.

**Status:** resolved

- [x] Effective Threshold resolution: a Variant's own `thresholdDays` wins, null inherits the parent's, and a thresholdless parent may still have thresholded Variants
- [x] Urgency ratio (days since last Entry divided by Threshold days) and state: `never` (thresholded, zero Entries), `fresh` below 0.8, `due-soon` from 0.8 up to 1, `overdue` at 1 or above, `neutral` with no Threshold
- [x] Home sort order: thresholded never-logged first, then descending ratio, then thresholdless below everything (never-logged first, then longest since logged)
- [x] Observed interval: mean gap over the last 10 Entries, defined only once at least 3 Entries exist, computed per-Variant for Variant rows
- [x] Threshold suggestion: fires when at least 3 Entries exist and the observed interval deviates more than 30% from the Threshold; a gentler "set threshold?" case for thresholdless Trackers with at least 3 Entries
- [x] Unit tests cover every boundary value (0.8, 1.0, the third Entry, the 30% edge) and day-bucketing in device-local time
