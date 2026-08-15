/**
 * The tap-to-log entry point (build ticket 12), widened by ticket 13 into
 * the shared entry point for the log sheet too: optimistic Entry, POST,
 * undo, and the frozen-order window, wired together. Home and List each
 * call this hook once and pass `logEntry` (with no overrides) to their
 * rows' `onTap` (src/client/routes/HomeRoute.tsx,
 * src/client/routes/ListRoute.tsx), and the same function (this time with
 * `entryOverrides`) to LogSheetHost's submit handler
 * (src/client/log/LogSheetHost.tsx).
 *
 * Ticket 13 wanted the same settle/toast/undo/freeze choreography for a
 * backdated/annotated log (a different `occurredAt`/duration/note, still one
 * Entry per log) — the seam is `logEntry(target, entryOverrides)`, where
 * `entryOverrides` defaults `occurredAt` to the actual moment of logging
 * (not frozen at sheet-open time) and `durationMinutes`/`note` to null.
 * Everything from `applyEntry` down (freeze, optimistic write, POST, undo)
 * was already entry-shape-agnostic, so widening it here didn't touch that.
 *
 * Ticket 17's outbox and ticket 19's pending chip build on this the same way:
 *   - ticket 17 replaces `postEntry`/`deleteEntry` (src/client/log/
 *     entryApi.ts) with outbox-queueing versions; the optimistic cache write
 *     (src/client/log/logCache.ts) and the freeze/undo choreography here are
 *     unchanged by going offline.
 *   - ticket 19 counts outbox rows; this hook doesn't track a pending count
 *     itself, only the single most recent undoable log.
 *
 * No retry, no queueing here (docs/tech-stack.md: ticket 12 is not the
 * outbox) — a failed POST reverts the optimistic entry and surfaces a
 * failure toast instead.
 */
import { useQueryClient } from '@tanstack/react-query'
import { uuidv7 } from 'uuidv7'
import type { BootstrapPayload, Entry } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { computeFreezeSnapshot } from './computeFreezeSnapshot'
import { deleteEntry, postEntry } from './entryApi'
import { findLatestEntry, setLatestEntryInCache, type EntryTarget } from './logCache'
import { logWindowStore } from './logWindowStore'

export type LoggableRow = EntryTarget

/**
 * Build ticket 13: what the log sheet can override on an otherwise-ordinary
 * log. `occurredAt` omitted (or undefined) means "the actual moment of
 * logging" — resolved fresh inside `logEntry`, never frozen at whatever
 * moment the sheet happened to be open, so leaving the sheet on its default
 * "now" chip behaves identically to a plain tap even if the user pauses to
 * type a note first.
 */
export interface EntryOverrides {
  readonly occurredAt?: string
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

const LOG_FAILURE_MESSAGE = "couldn't log — try again"
const UNDO_FAILURE_MESSAGE = "couldn't undo — offline"

export function useLogRow() {
  const queryClient = useQueryClient()

  function logEntry(target: LoggableRow, overrides: EntryOverrides = {}) {
    const payload = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    if (!payload) return

    const now = new Date()
    const freeze = computeFreezeSnapshot(payload.trackers, now)
    const previousLatestEntry = findLatestEntry(payload, target)
    const entryId = uuidv7()
    const nowIso = now.toISOString()
    const occurredAt = overrides.occurredAt ?? nowIso
    const durationMinutes = overrides.durationMinutes ?? null
    const note = overrides.note ?? null
    const entry: Entry = {
      id: entryId,
      trackerId: target.trackerId,
      variantId: target.variantId,
      occurredAt,
      durationMinutes,
      note,
      createdAt: nowIso,
    }

    /**
     * Backdating is what the log sheet exists for (build ticket 13), so a
     * logged Entry is routinely *older* than the row's existing latest one —
     * "yesterday" against something already logged this morning. `latestEntry`
     * means latest: writing an older Entry there would make the row claim it
     * was last done longer ago than it was, re-sort the list as though it were
     * more overdue, and persist that claim to the offline cache until the next
     * bootstrap recomputed it. The Entry is still created either way — it
     * belongs in the history, it just isn't what the row summarises.
     *
     * ISO-8601 UTC strings compare lexicographically in chronological order,
     * which is what both sides of this are (`toISOString()` here, the same on
     * the server).
     */
    const supersedesLatest = previousLatestEntry === null || occurredAt >= previousLatestEntry.occurredAt
    // null when nothing settles: no row's last-done moved, so none should
    // animate green or read "now" — but the toast and its undo still appear.
    const rowId = supersedesLatest ? (target.variantId ?? target.trackerId) : null

    if (supersedesLatest) applyEntry(entry)

    let outcome: 'pending' | 'success' | 'failure' = 'pending'
    let undoRequested = false

    function applyEntry(next: Entry | null) {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (current) =>
        current ? setLatestEntryInCache(current, { ...target, entry: next }) : current,
      )
    }

    /** only reverts if the cache still points at *our* optimistic entry — a newer tap on the same row must never be clobbered by an older one's failure/undo. */
    function revertIfStillOurs() {
      const current = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
      if (current && findLatestEntry(current, target)?.id === entryId) {
        applyEntry(previousLatestEntry)
      }
    }

    /** the mirror of revertIfStillOurs, for when an undo's DELETE turns out to have failed: put the entry back so the client never claims an undo it can't back up. */
    function reapplyIfStillReverted() {
      // nothing to put back if this Entry never became the row's latest.
      if (!supersedesLatest) return
      const current = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
      if (current && findLatestEntry(current, target)?.id !== entryId) {
        applyEntry(entry)
      }
    }

    /** is this attempt's window still the one on screen — i.e. safe to close/message without stomping a newer tap's active toast. */
    function isCurrentAttempt(): boolean {
      const currentState = logWindowStore.read()
      return currentState.kind === 'open' && currentState.entryId === entryId
    }

    function undo() {
      undoRequested = true
      revertIfStillOurs()
      // a stale onUndo (superseded by a later tap, e.g. the prior log's own
      // toast having already been dismissed) must not close a newer window.
      if (isCurrentAttempt()) {
        logWindowStore.closeSilently()
      }

      if (outcome === 'success') {
        void deleteEntry(entryId).catch(() => {
          reapplyIfStillReverted()
          logWindowStore.showMessage(UNDO_FAILURE_MESSAGE)
        })
      }
      // outcome === 'pending': the in-flight submit below notices undoRequested once it settles.
      // outcome === 'failure': nothing was ever created server-side; the cache is already reverted.
    }

    logWindowStore.open({ entryId, rowId, freeze, toastMessage: 'logged ✓', onUndo: undo })

    void submit()

    async function submit() {
      try {
        await postEntry({
          id: entryId,
          trackerId: target.trackerId,
          variantId: target.variantId,
          occurredAt,
          durationMinutes,
          note,
        })
        outcome = 'success'
        if (undoRequested) {
          try {
            await deleteEntry(entryId)
          } catch {
            reapplyIfStillReverted()
            logWindowStore.showMessage(UNDO_FAILURE_MESSAGE)
          }
        }
      } catch {
        outcome = 'failure'
        if (!undoRequested) {
          revertIfStillOurs()
          if (isCurrentAttempt()) {
            logWindowStore.showMessage(LOG_FAILURE_MESSAGE)
          }
        }
      }
    }
  }

  return { logEntry }
}
