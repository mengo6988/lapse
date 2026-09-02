# 21 — Activity screen

**What to build:** A reverse-chronological feed of what was logged recently across all Trackers — the "did I already log that?" screen. Its design pass happens in-build, extending the committed tokens; there is no separate mock by decision.

**Blocked by:** 09 (Design tokens and app shell), 12 (Tap-to-log).

**Status:** resolved

- [x] Recent Entries listed newest first, each showing its Tracker (and Variant when present), a relative time, and duration or note when present
- [x] Entries are day-bucketed in device-local time
- [x] Tapping an Entry reaches the place it can be edited or deleted
- [x] Empty state in the canonical copy voice
- [x] Decide in-build how the feed is sourced: the bootstrap payload carries only each row's latest Entry, so either aggregate the already-cached per-Tracker histories client-side or add a small recent-Entries read endpoint. Prefer the client-side aggregation if it holds; if a new endpoint is needed, keep it a dumb read and note it in the spec's API section

## Implementation notes

**Sourcing decision (the ticket's open question):** a new dumb read endpoint, not client-side aggregation. The bootstrap payload carries only each row's *latest* Entry, and per-Tracker histories are only in cache if the user happened to visit that Tracker's detail screen — neither can produce a true cross-Tracker feed.

`GET /api/entries?cursor=<entryId>&limit=50` → `200 { entries, nextCursor }`, `400 { error: 'invalid cursor' }`. Same query schema, limit clamping (default 50, cap 100), `(occurredAt desc, id desc)` cursor pair, and `limit + 1` has-more probe as `GET /trackers/:id/entries` — the only difference is no `trackerId` filter. Written into `docs/spec.md` § API.

Entries of archived Trackers are excluded **server-side**, via a cheap pre-query for archived ids and `notInArray`. Doing it client-side would under-fill a page and break the has-more probe. `notInArray` with an empty list degrades to `true` in drizzle-orm, so zero archived Trackers is not a special case — covered by the endpoint's own newest-first test, which has none.

**Files added** (all under `src/client/activity/`, replacing the placeholder `ActivityRoute.tsx`):

- `activityRows.ts` — resolves each wire Entry to a display row against the bootstrap cache's Tracker/Variant names; skips a dangling trackerId, falls back to a null variantName for a soft-deleted Variant.
- `dayBuckets.ts` — groups the already-newest-first rows into device-local calendar-day sections in one linear pass, reusing `domain/daysAgo.ts`'s local-midnight math for both the key and the label.
- `activityFormat.ts` — the row's clock time and its duration/note meta line.
- `entriesApi.ts`, `useActivityEntries.ts` — zod-validated fetch + `useInfiniteQuery` over the new endpoint.
- `useInfiniteScrollSentinel.ts` — a copy of `detail/`'s sentinel, which isn't exported from `detail/index.ts`. **Third near-duplicate of a shared concern in this codebase** (alongside `buildHomeRows` / `buildListRows` / `archivedRows`); worth folding into a shared module before a fourth appears.
- `ActivityEntryRow.tsx`, `ActivityDaySection.tsx`, `activity.css`.

## Post-agent integration notes

**Changed after the agent finished:** the row's time. The agent implemented the acceptance criterion literally — a *relative* time per row — and then flagged in its own report that this reads as redundant, because the day-bucket heading directly above already says `today` and so does every row under it.

Resolved by hoisting the relative half to the heading, where it is stated once, and giving the row the local clock time: `formatEntryRelative(occurredAt, now)` became `formatEntryTime(occurredAt)`, and the now-unused `now` prop was dropped from `ActivityEntryRow` and `ActivityDaySection`. This also matches what `docs/design.md` already required of the single-Tracker history list this screen is the cross-Tracker analogue of — "relative + absolute time". Recorded in `docs/design.md` § Activity. Reverting is a one-line change if the literal reading of the criterion is preferred.

Also: `ActivityDaySection` renders an `<h2>` plus its own `<ul>`, and both its tests wrapped that in a `<ul>` — invalid markup that the real route never produces. Wrapper changed to a `<div>`.

The empty state (`nothing logged yet`) and load failure (`couldn't load activity — try again`) were added to `docs/design.md`'s canonical-strings table, which had no entry for either.
