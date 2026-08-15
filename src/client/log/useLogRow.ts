/**
 * The tap-to-log entry point (build ticket 12): optimistic Entry, POST,
 * undo, and the frozen-order window, wired together. Home and List each
 * call this hook once and pass its `logRow` to their rows' `onTap`
 * (src/client/routes/HomeRoute.tsx, src/client/routes/ListRoute.tsx).
 *
 * Ticket 13's log sheet, ticket 17's outbox, and ticket 19's pending chip
 * all build on the pieces here rather than reinventing them:
 *   - ticket 13 wants the same settle/toast/undo/freeze choreography for a
 *     backdated/annotated log (a different `occurredAt`/duration/note, still
 *     one Entry per log). The cleanest seam is widening `logRow`'s
 *     `LoggableRow` into a `logEntry(target, entryOverrides)` that defaults
 *     `occurredAt` to now — everything from `applyEntry` down (freeze,
 *     optimistic write, POST, undo) is already entry-shape-agnostic.
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

const LOG_FAILURE_MESSAGE = "couldn't log — try again"
const UNDO_FAILURE_MESSAGE = "couldn't undo — offline"

export function useLogRow() {
  const queryClient = useQueryClient()

  function logRow(target: LoggableRow) {
    const payload = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    if (!payload) return

    const now = new Date()
    const freeze = computeFreezeSnapshot(payload.trackers, now)
    const previousLatestEntry = findLatestEntry(payload, target)
    const rowId = target.variantId ?? target.trackerId
    const entryId = uuidv7()
    const nowIso = now.toISOString()
    const entry: Entry = {
      id: entryId,
      trackerId: target.trackerId,
      variantId: target.variantId,
      occurredAt: nowIso,
      durationMinutes: null,
      note: null,
      createdAt: nowIso,
    }

    applyEntry(entry)

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
        await postEntry({ id: entryId, trackerId: target.trackerId, variantId: target.variantId, occurredAt: nowIso })
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

  return { logRow }
}
