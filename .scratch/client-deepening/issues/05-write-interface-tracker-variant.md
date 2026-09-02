# 05 — One write interface, starting with Tracker and Variant writes

**What to build:** Ten mutation hooks are the same three lines each. This ticket introduces the single interface for "send a write, then update cache" and moves the five Tracker and Variant writes onto it. Creating a Tracker, renaming one, archiving one, and adding, renaming or removing a Variant all behave exactly as they do now, including the per-field validation messages the forms show.

**Blocked by:** 04 — the write specs name that module's cache changes.

**Status:** resolved

The interface takes a spec: the route (which may depend on the input), the method, and what happens on success. Success is one of two kinds — graft a named cache change, or mark a query stale and refetch. The current code already does both; the spec makes the choice explicit.

Error handling is unchanged: per-field messages parsed from a rejected write, and a 401 or an unreachable server collapsing to the single "couldn't save — try again" message.

Named hooks may stay as one-line specs where a call site reads better for one. The rule is that no named hook contains logic.

- [x] One write hook exists, taking a spec of route, method and success behaviour
- [x] Success supports both grafting a named cache change and invalidating a query
- [x] The five Tracker and Variant writes go through it; their bespoke hooks contain no logic
- [x] Per-field validation errors still render next to the field that caused them
- [x] A 401 or an unreachable server still surfaces the existing single failure message
- [x] The retired hooks' test files are deleted
- [x] The write hook has one test file covering graft, invalidate, per-field rejection, 401 and network failure
- [x] The create/edit Tracker flow, the archive action and all screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `90d2ab0` — refactor: one write interface, starting with Tracker and Variant writes.
