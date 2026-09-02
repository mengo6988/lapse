# 02 — One Tracker row-flattener for List, Detail and Archived

**What to build:** The rule "a Tracker with Variants contributes one row per Variant, never a tracker-level row of its own" currently has four implementations. This ticket introduces the single owner of that rule and moves three of the four callers onto it. The List ledger, the Tracker detail screen and the Archived view render exactly the same rows as before.

**Blocked by:** None — can start immediately.

**Status:** resolved

The new module takes the Trackers, the current time, and options for the two things that genuinely differ between callers: whether archived Trackers are included, and whether the result is sorted by urgency. Detail's single-Tracker case is the same function over a one-element list.

All threshold, urgency and sort math stays in the existing domain modules — this reshapes data and recomputes nothing.

- [x] One flattener module exists, returning the established row shape, with options for archived inclusion and urgency sorting
- [x] The List ledger uses it and sorts by urgency as it does today
- [x] The Tracker detail screen uses it, keeping declaration order rather than urgency order, and still shows an archived Tracker's rows
- [x] The Archived view uses it and stops filtering by archived state itself
- [x] The three duplicate row builders and their test files are deleted
- [x] The flattener has one test file at its own interface, carrying every case the retired test files covered: a Tracker without Variants, a Tracker with Variants, a Variant with its own Threshold, archived included and excluded, sorted and unsorted
- [x] List, Detail and Archived screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `c1c6bf5` — refactor: one Tracker row-flattener for List, Detail and Archived.
