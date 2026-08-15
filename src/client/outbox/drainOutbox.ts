/**
 * One pass over the offline outbox (build ticket 17): send each queued item
 * to the server, oldest first, stopping the moment one can't be resolved
 * right now rather than skipping ahead to the next. Order matters here
 * specifically because a create has to land before the delete that undoes
 * it — src/client/log/entryApi.ts's `deleteEntry` only ever queues a delete
 * once the matching create is no longer sitting pending in front of it, so
 * a create/delete pair for the same id would arrive at the server
 * out-of-order if a later item raced ahead of an earlier one still waiting
 * on its own backoff.
 *
 * This module owns *sending*; it doesn't own scheduling. It has no timers
 * and no event listeners of its own — src/client/outbox/useOutboxDrain.ts
 * calls `drainOutboxOnce()` on mount, on every outboxStore change, and
 * after the backoff delay this module reports back via `retryAfterAttempts`
 * — so this file stays a single "attempt everything once" primitive that's
 * easy to reason about and test in isolation.
 */
import { ApiError, apiFetch, jsonRequest } from '../api/client'
import { buildCreateEntryBody } from '../log/entryApi'
import {
  claimOutboxItem,
  outboxStore,
  releaseOutboxItem,
  settleSentOutboxItem,
  updateOutboxItem,
  type OutboxItem,
} from './outboxStore'

export interface DrainResult {
  /**
   * The item's new attempt count when the pass stopped on a network failure
   * or 5xx — src/client/outbox/useOutboxDrain.ts feeds this into
   * `backoff(attempts)` to schedule the next pass. Null when the pass ran
   * to the end of the queue, or stopped because of a 401 (nothing useful to
   * retry until the user is signed in again).
   */
  readonly retryAfterAttempts: number | null
}

const NOTHING_TO_RETRY: DrainResult = { retryAfterAttempts: null }

/** guards a re-entrant call (e.g. 'online' firing while a pass is already mid-flight) from sending the same item twice. */
let draining = false
/** set when the guard turned a call away, so that trigger gets its pass rather than being lost. */
let rerunRequested = false

async function send(item: OutboxItem): Promise<void> {
  if (item.kind === 'delete') {
    await apiFetch(`/api/entries/${item.id}`, jsonRequest('DELETE'))
    return
  }
  // A 'create' always carries its POST body (see OutboxItem's header comment
  // in outboxStore.ts); a null here would mean a corrupted queue record, not
  // a case this pass can silently paper over.
  if (!item.input) throw new Error(`outbox item ${item.id} is a 'create' with no input`)
  await apiFetch('/api/entries', jsonRequest('POST', buildCreateEntryBody(item.input)))
}

/**
 * A trigger that arrives while a pass is already running is turned away by
 * the re-entrancy guard, and the change that caused it can be one this pass
 * has already walked past — build ticket 19's retry all, reviving a
 * dead-lettered item sitting at the front of the queue, is exactly that. So
 * the turned-away trigger is remembered and gets its own pass afterwards
 * rather than being dropped.
 *
 * Only when the finished pass has nothing waiting on a backoff, though: a
 * pass that stopped on a network failure or 5xx has already reported the
 * delay its next attempt should wait (`retryAfterAttempts`), and re-running
 * immediately would send that same item again with no delay at all — the
 * exact retry storm the backoff exists to prevent.
 */
export async function drainOutboxOnce(): Promise<DrainResult> {
  if (draining) {
    rerunRequested = true
    return NOTHING_TO_RETRY
  }

  draining = true
  let result: DrainResult
  try {
    rerunRequested = false
    result = await runPass()
  } finally {
    draining = false
  }

  if (rerunRequested && result.retryAfterAttempts === null) return drainOutboxOnce()
  return result
}

async function runPass(): Promise<DrainResult> {
  // Ids already looked at this pass. Re-reading outboxStore fresh on every
  // step (rather than iterating one snapshot array) means an item enqueued
  // mid-pass — e.g. a new tap landing while a slow request is in flight —
  // still gets its turn before this pass ends, instead of waiting for a
  // whole separate trigger; a dead-lettered item is added here too so a
  // pass doesn't loop on it forever.
  const seen = new Set<string>()

  for (;;) {
    const item = outboxStore.read().find((candidate) => !seen.has(candidate.id))
    if (!item) return NOTHING_TO_RETRY
    seen.add(item.id)

    if (item.status === 'dead') continue

    // src/client/log/entryApi.ts sends a write as it happens and records it
    // first, so a pass woken by that record finds an item already on the wire.
    // Leave it to its owner rather than sending it twice.
    if (!claimOutboxItem(item.id)) continue

    try {
      await send(item)
      if (await settleSentOutboxItem(item)) {
        // undo dropped this create mid-flight and settle queued the delete it
        // skipped — same id, so it has to come back off the seen list or this
        // loop would skip the item it was just handed.
        seen.delete(item.id)
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error

      if (error.status === 401) return NOTHING_TO_RETRY

      if (error.status !== null && error.status < 500) {
        await updateOutboxItem(item.id, { status: 'dead' })
        continue
      }

      // null (never reached the server) or 5xx: worth retrying, but not
      // right now — stop the whole pass so nothing behind this item is
      // sent out of order ahead of it.
      const attempts = item.attempts + 1
      await updateOutboxItem(item.id, { attempts })
      return { retryAfterAttempts: attempts }
    } finally {
      releaseOutboxItem(item.id)
    }
  }
}
