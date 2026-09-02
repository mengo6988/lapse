# 12 — Tap-to-log

**What to build:** The point of the app: tapping a row logs "I just did this" and the row goes fresh instantly, with five seconds to undo — and the list does not yank itself out from under the finger while that window is open.

**Blocked by:** 05 (Entries and history endpoints), 10 (Home digest), 11 (List tab).

**Status:** resolved

- [x] A tap creates an Entry optimistically with a client-generated UUIDv7 id and the row settles to fresh (green accent, count reading "now") on a spring of roughly 340ms
- [x] A `logged ✓` toast appears with undo for 5 seconds; undo removes the Entry and restores the previous state exactly
- [x] Row order is frozen for the duration of the undo window — the logged row lingers in place rather than jumping
- [x] On toast expiry the digest and list re-sort with a gentle fade of roughly 200ms and the next most urgent row takes the slot; never an instant jump
- [x] `prefers-reduced-motion` collapses the settle, the fade, and the re-sort into instant state changes while keeping the toast
- [x] Behavior matches the accepted prototype, which is the reference for anything this list leaves ambiguous

## Implementation notes

### Files added (`src/client/log/`, new directory)

- `logWindowStore.ts` — the cross-cutting store (module-level `useSyncExternalStore`, matching `tracker/trackerSheetStore.ts`'s shape). Holds the single active undo window (`closed | open | message`) and owns the 5s expiry timer itself, *not* a component ref — Home and List each mount their own `useLogRow()` instance, so a `useRef`-owned timer would be orphaned by route navigation mid-window. Also owns `resortToken`, which increments only on natural expiry (never on undo), the signal both routes watch to fade back into their live sort order.
- `computeFreezeSnapshot.ts` — snapshots the pre-tap slipping ids, quick-log ids, and full list order by composing `home/selectSlippingRows`, `home/selectQuickLogRows`, `home/homeRows`, and `list/buildListRows` — it never re-implements urgency or sorting.
- `applyFrozenOrder.ts` — generic `(liveRows, frozenIds, getId) => reordered rows`. Reorders *and* re-filters to the frozen id set (membership stays frozen too, not just order); each returned row's data still comes from the live array, so a just-logged row shows fresh state in its old slot.
- `logCache.ts` — `findLatestEntry` / `setLatestEntryInCache`: immutable read/write of a single Tracker's or Variant's `latestEntry` on the bootstrap cache. The two primitives the optimistic write and its undo both reduce to.
- `entryApi.ts` — `postEntry` / `deleteEntry` on top of the shared `apiFetch`/`jsonRequest`. No retry, no queueing (ticket 17 owns that).
- `useLogRow.ts` — the orchestration hook; `logRow({trackerId, variantId})` is the tap entry point. Optimistic write → freeze snapshot → POST → (undo | expiry | failure).
- `LogToast.tsx` — `role="status"`/`aria-live="polite"`, `logged ✓` + undo, or a plain message with no action for a failure.
- `log.css` — toast chrome + `.log-settle` (340ms spring)/`.log-resort` (200ms fade) animation classes. Leans entirely on the global `prefers-reduced-motion` collapse already in `src/client/styles/base.css` (`animation-duration: 0.01ms !important` on everything) rather than adding its own media query, per the ticket's steer.

### Wiring

- `home/SlippingCard.tsx`, `home/QuickLogTile.tsx` gained a `justLogged?: boolean` prop (adds `.log-settle` + forces the count to "now"); `home/SlippingSection.tsx`, `home/QuickLogSection.tsx` gained `justLoggedId?: string | null` and forward it. `home/home.css` gained `.slipping-card--fresh` (a frozen slot can now legitimately render `state: 'fresh'`, which the section never produced before this ticket).
- `list/ListRowItem.tsx` was restructured: the `<li>` keeps the urgency classes/divider, but its contents now live inside a real `<button>` (was a plain `<div>`) so the whole row is a proper, 44px+ tap target — `<p>` children became `<span>`s since `<button>`'s content model doesn't allow block-level children. Gained `onTap`/`justLogged` props. `list/list.css` moved the row's flex/padding/min-height onto the new `.list-row__button`.
- `routes/HomeRoute.tsx` / `routes/ListRoute.tsx` call `useLogRow()`, read `useLogWindowState()`/`useResortToken()`, and swap in `applyFrozenOrder(...)` output for the live selectors while a window is open; both mount `<LogToast />`.

### Freeze semantics — decided and documented here since the ticket asked for it

Freezing captures **membership and order together**, snapshotted from the trackers *as they stood immediately before* the current tap's cache mutation (mirrors the accepted prototype's `log()`, which reads `slipping(trackers)`/`sorted(trackers)` before reassigning `trackers`). Three arrays are captured per tap — `slippingIds`, `quickLogIds`, `listOrder` — because Home's slipping section has a due-soon/overdue membership filter that a live re-check would immediately fail once the row goes fresh; List's full ledger has no such filter, only order.

A single active undo window at a time ("single-level undo", same as the prototype): a second tap — even on the same row — opens a fresh window and freeze snapshot from whatever the world looks like *after* the first tap's optimistic update, and makes the first log's Entry permanent (no longer revertible via its own toast, which is gone anyway; its own POST/undo bookkeeping still resolves correctly and independently in the background). Undo only ever reverts the single most recent tap.

Undo when the POST hasn't confirmed yet: the cache reverts immediately (never waits on the network), and once the POST does land the hook fires the compensating `DELETE` on its own. If that `DELETE` fails (offline), the client re-applies the Entry rather than claiming an undo it can't back up, and shows `couldn't undo — offline` (the canonical string from docs/design.md).

### Seams for later tickets

- **Ticket 13 (long-press log sheet)** wants the same settle/toast/undo/freeze choreography for a backdated/annotated log. `useLogRow.ts`'s `logRow` currently always logs "now" with no duration/note; the clean extension is widening it (or adding a sibling function) that accepts entry overrides — everything from the optimistic cache write down (freeze, POST, undo, the store) is already entry-shape-agnostic. `applyFrozenOrder`/`computeFreezeSnapshot`/`logCache` need no changes at all.
- **Ticket 17 (outbox)** replaces `postEntry`/`deleteEntry` in `entryApi.ts` with outbox-queueing versions. The optimistic cache write and the freeze/undo choreography in `useLogRow.ts` don't need to change — only what happens when the POST is attempted.
- **Ticket 19 (pending chip)** counts outbox rows; nothing here tracks a pending count — `logWindowStore` only ever tracks the single most recent undoable log, by design (see freeze semantics above).

### Honest caveats

- The `prefers-reduced-motion` requirement is met by composition, not a dedicated rule: `.log-settle`/`.log-resort` are ordinary `animation` declarations, and the *existing* global rule in `src/client/styles/base.css` (out of this ticket's file fence) already forces `animation-duration: 0.01ms !important` under reduced motion. This can't be unit-tested in jsdom (no real animation timing), so it's verified by inspection rather than a test, consistent with how tickets 9–11 left the same global rule uncovered by component tests.
- Coverage for `src/client/log/**`: 100% statements/functions/lines, ~96% branches (full merged `npx vitest run --coverage` passes the 80% gate with room to spare; a couple of defensive `if (current) ...` null-cache guards in `useLogRow.ts` are the only uncovered branches).
