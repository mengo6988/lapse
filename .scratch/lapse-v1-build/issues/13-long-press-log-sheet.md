# 13 — Long-press log sheet

**What to build:** One sheet that handles backdating, duration, and a note — reached by holding a row rather than tapping it, so the one-tap path stays untouched.

**Blocked by:** 12 (Tap-to-log).

**Status:** resolved

- [x] Holding a row for 450ms opens the sheet; a shorter press still logs immediately as a tap, and dragging the list never triggers it
- [x] Time chips: now, 1h ago, yesterday, and pick — pick opens a native date/time input rather than a custom picker
- [x] Optional duration chips and an optional note of at most 500 characters, both informational and neither affecting Overdue math
- [x] Swipe-down or backdrop tap dismisses without logging
- [x] Logging from the sheet follows the same settle, toast, undo, and freeze-then-resort choreography as a tap

## Implementation notes

**The seam ticket 12 predicted, taken as written.** `useLogRow()` now returns `{ logEntry }` with signature `logEntry(target, overrides = {})`, where `EntryOverrides = { occurredAt?, durationMinutes?, note? }`. An omitted `occurredAt` resolves to the actual submit-time now rather than being frozen when the sheet opened, so leaving the sheet on its default "now" chip and pausing to type a note still logs at the moment **log** is pressed. Everything downstream — freeze snapshot, optimistic write, POST, undo — was already entry-shape-agnostic and did not change. Tickets 17 and 19 build on `logEntry`, not `logRow`.

**Files added** (all under `src/client/log/`): `useLongPress.ts` (450ms, 10px slop cancel, one-shot click suppression), `logSheetStore.ts`, `datetimeLocal.ts` (a copy of `detail/`'s, which isn't exported from `detail/index.ts`), `LogSheet.tsx`, `LogSheetHost.tsx`. `entryApi.ts`'s `postEntry` widened with optional `durationMinutes`/`note`.

**Long-press vs swipe.** `SwipeRevealRow`'s pointer handlers live one level up on the sliding content div, so a swipe's pointer events reach both it and the row's tap button. Nothing had to be coordinated between them: the hook's own move-cancels-the-pending-press rule fires long before 450ms elapses, so a swipe — or the list simply scrolling — can never open the sheet. `SwipeRevealRow` was not touched.

**Home cards call `logSheetStore.open()` directly** rather than taking a prop, because `SlippingSection`/`QuickLogSection` sit between `HomeRoute` and the cards and forward no long-press callback. `ListRowItem` follows the same pattern for consistency. This mirrors how the FAB opens `trackerSheetStore`.

The agent also found and fixed a bug of its own making en route: the custom-duration `<input type="number" max={1440}>` was silently blocking form submission through native HTML5 constraint validation before the JS validation could run, so its error never reached the accessible `FieldError` region. Fixed with `noValidate` on the form.

## Post-agent integration notes

**Defect found and fixed after the agent finished: a backdated log overwrote a newer `latestEntry`.**

Backdating is the entire point of this sheet, so a logged Entry is routinely *older* than the row's existing latest one — "yesterday" against something already logged this morning. `logEntry` applied the optimistic write unconditionally, so the older Entry became the row's `latestEntry`. The row would then claim it was last done longer ago than it was, sort itself up the list as more overdue on that claim, and persist it to the offline IndexedDB cache until a bootstrap recomputed it.

Fixed in `useLogRow.ts` with a `supersedesLatest` check (ISO-8601 UTC strings compare lexicographically in chronological order, which is what both sides are). When the new Entry lands behind the existing latest, the cache is left alone — the Entry is still POSTed, because it belongs in the history, it just isn't what the row summarises. `reapplyIfStillReverted` had to be guarded too, since its "is the cache still showing our entry?" test reads as false when the entry was never applied, which would have made a failed undo write the stale Entry in after all.

That also meant a row shouldn't settle green or read "now" when nothing about it moved, so `logWindowStore`'s `rowId` became `string | null` — null keeps the toast and its undo while matching no row. Five tests added covering: latest untouched, Entry still POSTed, no settle claimed, undo still deletes, and a backdated-but-still-newest Entry becoming the latest as normal.

**Second defect: iOS suppressed nothing during the 450ms hold.** No surface carried `-webkit-touch-callout: none` or `user-select: none`, so holding a row on iOS Safari — the only platform this app targets — raises the system text-selection callout over it and can cancel the pointer sequence out from under `useLongPress`. Added a shared `log-pressable` class in `log.css`, applied to the three long-pressable surfaces, which also sets `touch-action: manipulation` to drop the double-tap-zoom delay. (On list rows that intersects with `SwipeRevealRow`'s `pan-y` and stays `pan-y`, so the swipe is unaffected.)

**Decisions the agent made that are worth a second look:** the sheet's title is a generic "log entry" rather than the row's name; the "1h ago"/"yesterday" chips resolve against the render's `now` rather than a fresh read at submit; and a `pick…` value in the future is sent as-is and clamped server-side per `docs/spec.md` § Validation, so the client shows the unclamped time until the next bootstrap.
