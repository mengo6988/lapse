# 16 — Archived view

**What to build:** Archived Trackers are findable, restorable, and — only from here, only with a confirmation that names the cost — permanently deletable.

**Blocked by:** 14 (Create and edit Tracker, archive).

**Status:** resolved

- [x] The archived list is reachable and shows archived Trackers with their last-done state
- [x] Unarchive restores the Tracker to home and list with its history intact
- [x] Hard delete is offered only here, behind a confirmation that states how many Entries will be destroyed
- [x] Confirming removes the Tracker, its Variants, and its Entries; cancelling changes nothing

## Implementation notes

**Files added** (all under `src/client/archived/`, replacing the placeholder `ArchivedRoute.tsx`):

- `ArchivedRoute.tsx` — the screen: back button + title, archived-Tracker list (sorted most-recently-archived first), empty state, owns the hard-delete dialog's open/close state.
- `ArchivedTrackerRow.tsx` — one row: name, per-Variant (or tracker-level) last-done subline via `formatListRow`, "unarchive" button (reuses `tracker/useUpdateTracker` with `{ archived: false }` unchanged), "delete" button (calls back up to `ArchivedRoute` with the clicked element for focus restore).
- `archivedRows.ts` — builds `ListRow`-shaped last-done rows for an archived Tracker (one row per Variant, or one tracker-level row) — necessarily duplicates `list/buildListRows.ts`'s row-shaping helpers since they aren't exported and that module hard-filters archived Trackers out.
- `HardDeleteDialog.tsx` — the confirmation: proper `role="dialog"`/`aria-modal`, focus trap + Escape-to-cancel via `tracker/useFocusTrap` (reused unchanged), "cancel" is first-in-DOM so it — not the destructive action — gets the open-focus. Shows a loading state, then "delete "<name>"? destroys N entries — can't be undone.", or a retry affordance if the count fetch fails. The delete button stays disabled until a real count has loaded.
- `entryCount.ts` / `useEntryCount.ts` — the Entry count for the confirmation copy.
- `archivedCache.ts` / `useHardDeleteTracker.ts` — the `DELETE /trackers/:id` mutation and its immutable bootstrap-cache removal, reusing `mutationFetch`/`TrackerApiError` from `tracker/mutationClient.ts` per the ticket's guidance.
- `icons.tsx` — a local `BackIcon` (depth-2 back affordance per docs/design.md § Navigation); `shell/icons.tsx` was off-limits.
- `archived.css` — colocated styles, imported from `ArchivedRoute.tsx` only (not `styles/index.css`), matching `list/list.css`'s precedent.
- One `*.test.ts(x)` per module above; 39 new tests, all passing (`npx vitest run` — 457 tests total, all green; `npm run typecheck` clean).

**Entry point for ticket 22 (settings screen):** `SettingsRoute.tsx` was outside this ticket's file fence, so nothing links here yet. Ticket 22 should add a control that does `navigate('/archived')` (route already registered in `AppShell.tsx`). The back button here always returns to `/settings` (a fixed target, not browser history), so that round-trip will work once ticket 22 adds the forward link.

**Decisions the docs didn't settle, made here:**

- **Entry count source.** `DELETE /trackers/:id` already existed (with the archived-only guard, cascade delete, and server tests already in place) — per the file fence, that meant no server changes were in scope at all. The bootstrap payload carries no Entry count. Chosen approach: on-demand only (never eager, never for the whole list) — when the delete dialog opens for one Tracker, walk `GET /trackers/:id/entries` at its max page size (100) and sum page lengths. One request for most Trackers at this app's single-user scale; exact, never estimated.
- **Archived-list sort order.** Not specified in docs/design.md. Chose most-recently-archived-first (`archivedAt` descending) — the only ordering signal bootstrap actually carries for archived rows.
- **Row visual treatment.** Archived rows reuse `formatListRow`'s text formatting but deliberately drop the urgency accent bar/color used on home/list — an archived item is inert, not ranked by how overdue it once was, so coloring it as such would misrepresent it.
- **Hard-delete UI shape.** A two-button modal (cancel / delete forever) rather than a typed-name confirmation — the ticket's own constraints (default focus not on the destructive action, cost stated in the copy) are met without it, and it matches `ArchiveSection`'s established confirm-affordance weight for this single-user app.

No acceptance box was left unchecked.

### Post-agent integration note

`fetchEntryCount` followed the server's entry cursor with no termination check,
so a cursor that failed to advance (or an empty page still offering one) would
have looped forever and hung the delete confirmation. It now throws instead,
covered by two tests.
