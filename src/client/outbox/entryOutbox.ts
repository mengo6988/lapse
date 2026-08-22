/**
 * The single owner of sending a queued Entry write (client-deepening ticket
 * 08 — this module replaces src/client/log/entryApi.ts and src/client/
 * outbox/drainOutbox.ts, which used to split the job and import each other
 * to stay in step): POST /entries and DELETE /entries/:id (docs/spec.md §
 * API) on top of the shared `apiFetch`/`jsonRequest` (src/client/api/
 * client.ts is the only fetch path in the client), for both a live tap-to-log
 * and a drain pass over the offline outbox (src/client/outbox/
 * outboxStore.ts). It exposes exactly three functions: `postEntry`,
 * `deleteEntry`, and `drainOutboxOnce`.
 *
 * Every write is recorded in the outbox before it is attempted, and only a
 * failure the outbox can't own ever reaches a live caller. The caller's
 * optimistic UI (src/client/log/useLogRow.ts) is therefore never rolled back
 * for a failure this module is about to retry on its own.
 *
 * This module owns *sending*; it doesn't own scheduling. It has no timers
 * and no event listeners of its own — src/client/outbox/useOutboxDrain.ts
 * calls `drainOutboxOnce()` on mount, on every outboxStore change, and after
 * the backoff delay this module reports back via `retryAfterAttempts` — so
 * this file stays a single "send a write, or attempt everything queued once"
 * primitive that's easy to reason about and test in isolation.
 */
import { ApiError, apiFetch, jsonRequest } from '../api/client'
import {
  claimOutboxItem,
  enqueueOutboxItem,
  outboxStore,
  releaseOutboxItem,
  removeOutboxItem,
  settleSentOutboxItem,
  updateOutboxItem,
  type CreateEntryInput,
  type OutboxItem,
} from './outboxStore'

function buildCreateEntryBody(input: CreateEntryInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: input.id,
    trackerId: input.trackerId,
    occurredAt: input.occurredAt,
  }
  if (input.variantId !== null) body.variantId = input.variantId
  if (input.durationMinutes != null) body.durationMinutes = input.durationMinutes
  if (input.note != null) body.note = input.note
  return body
}

/**
 * The request an outbox item turns into, shared by both a live send and a
 * drain pass so a replayed create's body is constructed identically to a
 * first attempt's.
 */
function requestFor(item: OutboxItem): { path: string; init: RequestInit } {
  if (item.kind === 'delete') {
    return { path: `/api/entries/${item.id}`, init: jsonRequest('DELETE') }
  }
  // A 'create' always carries its POST body (see OutboxItem's header comment
  // in outboxStore.ts); a null here would mean a corrupted queue record, not
  // a case this can silently paper over.
  if (!item.input) throw new Error(`outbox item ${item.id} is a 'create' with no input`)
  return { path: '/api/entries', init: jsonRequest('POST', buildCreateEntryBody(item.input)) }
}

/**
 * Writes the outbox record first, then attempts the request (docs/tech-stack.md
 * § Outbox: "outbox record first (durable) → optimistic cache update → attempt
 * POST → success removes record"). Queueing only *after* a failure would be
 * simpler, but it loses the write outright if the app is killed while the
 * request is in flight — which on iOS is an ordinary way for a backgrounded
 * PWA to end, and losing a tap is the one thing the outbox exists to prevent.
 *
 * Success retires the record. A 401 retires it too and rethrows: `apiFetch`
 * has already marked the session unauthorized (src/client/auth/session.ts) and
 * the shell is about to swap in the login screen, so keeping a write nobody is
 * authenticated for would just be storing a doomed retry. Anything that isn't
 * the shared ApiError also rethrows — apiFetch never throws anything else, but
 * swallowing an unrecognised error would hide a real bug rather than surface
 * it.
 *
 * Every other failure leaves the record queued: a network error or 5xx stays
 * `pending` for a drain pass to retry, and any other 4xx dead-letters, because
 * the server rejected the write on its merits and retrying an unchanged body
 * would only ever fail the same way again. It waits in the queued sheet for a
 * manual retry instead.
 */
async function sendQueued(item: OutboxItem): Promise<void> {
  // Claimed *before* the enqueue, not after: the enqueue notifies the store
  // synchronously, which wakes a drain pass, which would otherwise pick this
  // brand-new item up and send it in parallel with the send below. The claim
  // has to already be held by the time that happens. See `claimOutboxItem` in
  // src/client/outbox/outboxStore.ts for what the two racing sends did.
  claimOutboxItem(item.id)
  await enqueueOutboxItem(item)

  const { path, init } = requestFor(item)
  let outcome: 'sent' | 'dead' | 'retryable' = 'sent'
  try {
    await apiFetch(path, init)
  } catch (error) {
    if (!(error instanceof ApiError)) {
      await removeOutboxItem(item.id)
      throw error
    }
    if (error.status === 401) {
      await removeOutboxItem(item.id)
      throw error
    }
    outcome = error.status !== null && error.status < 500 ? 'dead' : 'retryable'
    if (outcome === 'dead') await updateOutboxItem(item.id, { status: 'dead' })
  } finally {
    // released before settling, so a drain pass woken by the settle's own
    // store change is free to pick up whatever that leaves behind — a
    // dead-lettered item, or the compensating delete an undo mid-flight needs
    // sent.
    releaseOutboxItem(item.id)
  }

  /**
   * A network error or 5xx leaves the record pending — but pending is not the
   * same as scheduled. This is the *live* send path, and nothing else is
   * watching it: the enqueue above already woke a drain pass, which found the
   * item claimed by this very send and walked past it, so that pass ended with
   * nothing to retry and no timer set. Without the bump below the write then
   * sits there until some unrelated trigger happens along (another tap, an
   * `online` event, the tab being hidden and shown again) — the user watching
   * a connected app would never see it land, which is not what
   * docs/tech-stack.md § Outbox means by "lives until sent or user-discarded".
   *
   * Bumping the attempt count is the whole fix: it notifies the store, which
   * wakes a drain pass (src/client/outbox/useOutboxDrain.ts) that can now
   * actually claim the item, and that pass owns the backoff from there.
   * It has to happen *after* the `finally` releases the claim — inside the
   * catch, the woken pass would find the item still claimed and walk past it
   * exactly like the first one did.
   */
  if (outcome === 'retryable') return updateOutboxItem(item.id, { attempts: item.attempts + 1 })
  if (outcome === 'dead') return

  await settleSentOutboxItem(item)
}

function queuedAt(): string {
  return new Date().toISOString()
}

export function postEntry(input: CreateEntryInput): Promise<void> {
  return sendQueued({ id: input.id, kind: 'create', input, attempts: 0, status: 'pending', queuedAt: queuedAt() })
}

export async function deleteEntry(id: string): Promise<void> {
  // Undo of a log that never left the device: drop the queued create
  // outright. There is nothing server-side to compensate for, so queueing a
  // delete behind it would just be a wasted round trip the moment the
  // create's own retry landed.
  //
  // Dead-lettered creates count too, not just pending ones: a dead letter is
  // a write the server *rejected*, so that Entry exists even less than a
  // waiting one does. Sending a DELETE for it would 404, and a 404 is a 4xx —
  // it would dead-letter a second junk item next to the first.
  const queuedCreate = outboxStore.read().find((item) => item.id === id && item.kind === 'create')
  if (queuedCreate) {
    await removeOutboxItem(id)
    return
  }

  await sendQueued({ id, kind: 'delete', input: null, attempts: 0, status: 'pending', queuedAt: queuedAt() })
}

export interface DrainResult {
  /**
   * The item's new attempt count when a pass stopped on a network failure or
   * 5xx — src/client/outbox/useOutboxDrain.ts feeds this into
   * `backoff(attempts)` to schedule the next pass. Null when a pass ran to
   * the end of the queue, or stopped because of a 401 (nothing useful to
   * retry until the user is signed in again).
   */
  readonly retryAfterAttempts: number | null
}

const NOTHING_TO_RETRY: DrainResult = { retryAfterAttempts: null }

/** guards a re-entrant call (e.g. 'online' firing while a pass is already mid-flight) from sending the same item twice. */
let draining = false
/** set when the guard turned a call away, so that trigger gets its pass rather than being lost. */
let rerunRequested = false

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

/**
 * One pass over the queue: send each queued item to the server, oldest
 * first, stopping the moment one can't be resolved right now rather than
 * skipping ahead to the next. Order matters here specifically because a
 * create has to land before the delete that undoes it — `deleteEntry` above
 * only ever queues a delete once the matching create is no longer sitting
 * pending in front of it, so a create/delete pair for the same id would
 * arrive at the server out-of-order if a later item raced ahead of an
 * earlier one still waiting on its own backoff.
 */
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

    // `postEntry`/`deleteEntry` above send a write as it happens and record
    // it first, so a pass woken by that record finds an item already on the
    // wire. Leave it to its owner rather than sending it twice.
    if (!claimOutboxItem(item.id)) continue

    try {
      const { path, init } = requestFor(item)
      await apiFetch(path, init)
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
