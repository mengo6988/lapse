# 15 — Tracker detail and history

**What to build:** Opening a Tracker shows what actually happened: per-Variant state, the full Entry history (editable and deletable), the observed-interval line, and the Threshold suggestion when reality has drifted from the plan.

**Blocked by:** 05 (Entries and history endpoints), 07 (Pure domain modules), 11 (List tab).

**Status:** resolved

- [x] Detail shows per-Variant summaries with their effective Thresholds and last-done state
- [x] The Entry list is cursor-paginated and loads the next page on scroll, newest first
- [x] Entries are editable (time, duration, note) and deletable from here; tracker-level Entries appear in history without resetting any Variant
- [x] The observed-interval line ("actually every ~Nd") appears once at least 3 Entries exist, per-Variant for Variant rows
- [x] The Threshold suggestion hint appears with one-tap accept when the observed interval deviates more than 30%, and the gentler "set threshold?" hint appears for thresholdless Trackers with at least 3 Entries — never on home, never as a notification

## Implementation notes

**Files added**, all under `src/client/detail/` (each with a co-located `.test.ts`/`.test.tsx`, 19 test files / 81 tests total):

- Swipe-to-reveal (the reusable, self-contained piece): `useSwipeReveal.ts`, `SwipeRevealRow.tsx`
- Screen: `TrackerDetailRoute.tsx` (replaces the placeholder), `TrackerDetailScreen.tsx`
- Per-Variant summary: `detailRows.ts`, `variantInsights.ts`, `VariantSummaryList.tsx`, `VariantSummaryRow.tsx`
- Entry history: `entriesApi.ts`, `useTrackerEntries.ts`, `useInfiniteScrollSentinel.ts`, `entriesCache.ts`, `EntryHistoryList.tsx`, `EntryRow.tsx`, `entryFormat.ts`
- Entry edit/delete: `EntryEditSheet.tsx`, `useUpdateEntry.ts`, `useDeleteEntry.ts`, `datetimeLocal.ts`
- `detail.css` (swipe-row + detail screen + entry-edit sheet styles), `index.ts` (public exports)

**The one integration point `ListRowItem.tsx` needs** (owned by the list ticket, not edited here): swap the row's `<li className={...}>...</li>` for `<SwipeRevealRow className={...} onDetails={() => navigate(\`/tracker/${row.trackerId}\`)}>...</SwipeRevealRow>` (same children unchanged), plus `import { SwipeRevealRow } from '../detail'` and a `useNavigate()` call. `SwipeRevealRow` renders its own `<li>` — do not wrap it in another one. Full prop contract and rationale are in `SwipeRevealRow.tsx`'s doc comment.

**What ticket 13 (log sheet) can share**: `EntryEditSheet.tsx`'s time/duration/note field markup and chip pattern (now/1h ago/yesterday chips + `<input type="datetime-local">` for time; 15/30/60 quick chips + number input for duration) is a close match for the log sheet's fields, modulo one real difference — the log sheet creates a new Entry (defaults to "now", no delete), this one edits an existing one's `occurredAt`. `datetimeLocal.ts`'s ISO↔`datetime-local` conversions are generically reusable as-is.

**Design decisions the docs didn't settle, made here:**
- **Threshold-suggestion accept target**: docs/spec.md doesn't say whether "accept" writes the suggested Threshold to the Tracker or the Variant when Variants exist. Settled as: write to whichever entity owns the *effective* Threshold being evaluated — the Variant itself for a Variant row (even one currently inheriting the parent's Threshold — the suggestion is Variant-specific data, so accepting gives it its own override), the Tracker for a tracker-level row. See `VariantSummaryList.tsx`'s doc comment.
- **Observed interval / suggestion data scope**: computed from whichever Entry-history pages the infinite-scroll query has loaded so far for that row's own `variantId` (not a separate full-history fetch) — consistent with ADR-0001 (client computes, server stays dumb CRUD) and cheap since the default page size (20) covers the "last 10" window for all but unusually high-variant-count Trackers. Refines automatically as the user scrolls further back.
- **Back navigation**: the header back button always goes to `/list` explicitly (not `navigate(-1)`), since a deep link straight into `/tracker/:id` has no guaranteed prior app history to go back to, and docs/design.md places detail directly under the List tab (depth 2).
- **Entry delete's confirm affordance** lives inside the edit sheet (tap a row → edit sheet → delete, with a two-step inline confirm), per docs/design.md's "Tap → edit sheet ... + delete" phrasing — there's no separate delete-from-the-list-row affordance.

**Accessibility**: real `<button>` elements throughout (no gesture-only affordances); `.detail-entry`, header back/edit, chips, and the swipe action all meet the 44px `--touch-target-min`; focus rings come from the existing global `:focus-visible` rule in `src/client/styles/base.css` (plus an inset override on the swipe action and entry rows, since they sit inside `overflow: hidden` containers where the default ring would clip). The swipe action button is a real, always-mounted, always-focusable `<button>` — reachable with no gesture at all — and focusing it visually reveals the row for a sighted keyboard user (not just a logical state change). Reveal/conceal animation respects `prefers-reduced-motion` via `detail.css`. `EntryEditSheet` reuses `TrackerSheet` + `useFocusTrap` from `src/client/tracker` (imported, not edited) for its dialog role, focus trap, and Escape-to-cancel.

**Verification**: `npx vitest run --project client` — 93 files / 454 tests pass, including the 81 new ones. `npm run typecheck` is clean. `npx vitest run --coverage` (client + server) — 98.42% statements / 94.48% branches overall, `src/client/detail/**` itself at 96.51% statements / 89.61% branches, both well above the 80% gate. One pre-existing, out-of-scope flake was observed only under the full combined run: 3 tests in `src/client/routes/HomeRoute.test.tsx` (owned by another ticket, outside this ticket's fence) fail when run alongside the full suite but pass 9/9 in isolation — not touched, not caused by anything in `src/client/detail/**`.

No acceptance box was left unticked.

### Post-agent integration notes

Wired into the list at commit `aee3283`: `ListRowItem` now renders `SwipeRevealRow`
as its `<li>` and takes an `onOpenDetail?: (row: ListRow) => void` prop, which
`ListRoute` fills with `navigate('/tracker/' + row.trackerId)`. The row's
`list-row list-row--{urgency}` classes moved onto the sliding content surface,
so tests asserting them query `.swipe-row__content` rather than the `<li>`.

One defect fixed at the seam with ticket 12: `SwipeRevealRow` did not suppress
the click that ends a swipe, so swiping a row would have slid it open *and*
fired the tap-to-log button underneath — swiping to browse history would have
silently written an Entry. A swipe now swallows its trailing click, and a tap
on an already-revealed row conceals it instead of logging. Vertical drags and
plain taps still reach the row content. Four tests cover this.
