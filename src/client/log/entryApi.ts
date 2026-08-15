/**
 * POST /entries and DELETE /entries/:id (docs/spec.md § API) on top of the
 * shared `apiFetch`/`jsonRequest` (src/client/api/client.ts is the only
 * fetch path in the client). Build ticket 17 widens this from "throw on
 * failure" to "queue, then send": every write is recorded in the offline
 * outbox (src/client/outbox/outboxStore.ts) before it is attempted, and only
 * a failure the outbox can't own ever reaches the caller. The caller's
 * optimistic UI (src/client/log/useLogRow.ts) is therefore never rolled back
 * for a failure the outbox is about to retry on its own. `sendQueued` below
 * carries the details of which failure is which.
 *
 * src/client/outbox/drainOutbox.ts (this ticket) is the only other module
 * that sends these writes over the network; it reuses `buildCreateEntryBody`
 * below so a replayed create's body is constructed identically to a first
 * attempt's.
 */
import { ApiError, apiFetch, jsonRequest } from '../api/client'
import {
  enqueueOutboxItem,
  outboxStore,
  removeOutboxItem,
  settleSentOutboxItem,
  updateOutboxItem,
  type OutboxItem,
} from '../outbox/outboxStore'

export interface CreateEntryInput {
  readonly id: string
  readonly trackerId: string
  readonly variantId: string | null
  readonly occurredAt: string
  /** build ticket 13: the log sheet's optional duration/note. Both nullable+optional server-side (src/server/routes/entries.ts), so a null/omitted value here is just left out of the body rather than sent explicitly. */
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

/**
 * The create schema (src/server/routes/entries.ts) treats variantId as
 * `.optional()`, not `.nullable()` — a tracker-level log must omit the key
 * entirely rather than send `variantId: null`. durationMinutes/note are
 * `.nullable().optional()`, so omitting a null value is equally valid and
 * keeps a plain tap's body exactly as small as it was before this ticket.
 */
export function buildCreateEntryBody(input: CreateEntryInput): Record<string, unknown> {
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
 * `pending` for the drain to retry, and any other 4xx dead-letters, because
 * the server rejected the write on its merits and retrying an unchanged body
 * would only ever fail the same way again. It waits in the queued sheet
 * (build ticket 19) for a manual retry instead.
 */
async function sendQueued(item: OutboxItem, path: string, init: RequestInit): Promise<void> {
  await enqueueOutboxItem(item)

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
    if (error.status !== null && error.status < 500) {
      await updateOutboxItem(item.id, { status: 'dead' })
    }
    return
  }

  await settleSentOutboxItem(item)
}

function queuedAt(): string {
  return new Date().toISOString()
}

export function postEntry(input: CreateEntryInput): Promise<void> {
  return sendQueued(
    { id: input.id, kind: 'create', input, attempts: 0, status: 'pending', queuedAt: queuedAt() },
    '/api/entries',
    jsonRequest('POST', buildCreateEntryBody(input)),
  )
}

export async function deleteEntry(id: string): Promise<void> {
  // Undo of a log that never left the device (acceptance criterion 5): drop
  // the queued create outright. There is nothing server-side to compensate
  // for, so queueing a delete behind it would just be a wasted round trip
  // the moment the create's own retry landed.
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

  await sendQueued(
    { id, kind: 'delete', input: null, attempts: 0, status: 'pending', queuedAt: queuedAt() },
    `/api/entries/${id}`,
    jsonRequest('DELETE'),
  )
}
