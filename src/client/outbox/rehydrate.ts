/**
 * The rehydration overlay docs/tech-stack.md § Outbox promises: "after
 * bootstrap fetch, pending outbox entries re-apply on top of server data (as
 * `latestEntry` where newer) so a row logged offline doesn't flip back to
 * overdue on reload."
 *
 * Without it the queue and the list openly contradict each other. The
 * optimistic write from a tap lives in the query cache
 * (src/client/log/useLogRow.ts); the durable record of it lives in the
 * outbox. A fresh `/bootstrap` response overwrites the first and not the
 * second, so any refetch that lands before the queue drains — a window
 * refocus, a remount past the 60s `staleTime` (src/client/query/client.ts) —
 * puts the row back to its pre-tap state while the header chip is still
 * reporting "1 queued". The row says you never did it; the chip says the app
 * is still trying to tell the server you did.
 *
 * Applied on read rather than merged into the fetched payload on write
 * (src/client/query/useBootstrap.ts). Two reasons: the overlay then can't
 * race the queue's own async load from IndexedDB at launch, and what gets
 * persisted to the offline cache stays the server's own view, with the queue
 * persisted separately alongside it — so the next launch rebuilds the same
 * overlay from the same two durable pieces instead of inheriting a merge
 * whose inputs it can no longer see.
 */
import type { BootstrapPayload, Entry } from '../api'
import { findLatestEntry, setLatestEntryInCache } from '../query/bootstrapCache'
import type { OutboxItem } from './outboxStore'

/**
 * The Entry a queued 'create' is holding. `queuedAt` stands in for the
 * server's `createdAt` — that is exactly what it is, the moment this client
 * made the row, and the server will stamp its own when the write lands.
 */
function queuedEntry(item: OutboxItem): Entry | null {
  if (item.kind !== 'create' || item.input === null) return null
  return {
    id: item.input.id,
    trackerId: item.input.trackerId,
    variantId: item.input.variantId,
    occurredAt: item.input.occurredAt,
    durationMinutes: item.input.durationMinutes ?? null,
    note: item.input.note ?? null,
    createdAt: item.queuedAt,
  }
}

/**
 * Re-applies every queued Entry that is newer than what the payload already
 * has for that row.
 *
 * Only `pending` creates. A `dead` item is one the server rejected on its
 * merits (src/client/outbox/entryOutbox.ts), so it is never going to land —
 * showing the row as logged would be claiming something that isn't true and
 * won't become true; it waits in the queued sheet to be retried or discarded
 * instead. Queued deletes are skipped for a different reason: undoing a row
 * back to its *previous* Entry needs a value this payload no longer carries,
 * and the delete lands and self-corrects on the next fetch anyway.
 *
 * Newer-only, not last-write-wins, for the same reason `useLogRow` guards its
 * own optimistic write: a backdated log ("yesterday") is routinely older than
 * the row's existing latest, and `latestEntry` means latest. ISO-8601 UTC
 * strings compare lexicographically in chronological order.
 */
export function applyPendingEntries(
  payload: BootstrapPayload,
  items: readonly OutboxItem[],
): BootstrapPayload {
  return items.reduce((current, item) => {
    if (item.status !== 'pending') return current
    const entry = queuedEntry(item)
    if (entry === null) return current

    const target = { trackerId: entry.trackerId, variantId: entry.variantId }
    const existing = findLatestEntry(current, target)
    if (existing !== null && entry.occurredAt < existing.occurredAt) return current

    return setLatestEntryInCache(current, { ...target, entry })
  }, payload)
}
