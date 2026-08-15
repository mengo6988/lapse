/**
 * The offline outbox's queue state (build tickets 17 and 19): an
 * IndexedDB-persisted list of Entry writes that couldn't reach the server,
 * mirrored in memory so React can read it synchronously.
 *
 * Module-level `useSyncExternalStore`, matching src/client/log/
 * logWindowStore.ts and src/client/tracker/trackerSheetStore.ts. It has to
 * live outside the component tree for the same reason those do, and one more:
 * a log tap queues from src/client/outbox/entryOutbox.ts, which is a plain
 * module with no React context to reach for.
 *
 * This module owns the *queue* — what is waiting, and durably remembering it
 * across a reload. It deliberately owns no networking: the drain loop
 * (build ticket 17) subscribes here and reacts to items appearing, and the
 * pending chip and queued sheet (ticket 19) subscribe here to render them.
 * That keeps the dependency one-way — nothing in this file knows a drain
 * exists — so `retryAllOutboxItems` simply flips dead items back to pending
 * and the drain notices, rather than the two calling into each other.
 *
 * Persistence reuses idb-keyval (already a dependency, and already how the
 * query cache persists) through the same injectable-store seam as
 * src/client/query/storage.ts: jsdom has no IndexedDB, and a plain in-memory
 * stand-in is less machinery than pulling in fake-indexeddb.
 */
import { useSyncExternalStore } from 'react'
import { del, get, set } from 'idb-keyval'
import type { KeyValStore } from '../query/storage'

export const OUTBOX_STORAGE_KEY = 'lapse-outbox'

/**
 * The shape of a queued 'create': the same fields src/client/outbox/
 * entryOutbox.ts's `postEntry` takes, durable enough to survive a reload and
 * be replayed later.
 *
 * The create schema (src/server/routes/entries.ts) treats variantId as
 * `.optional()`, not `.nullable()` — a tracker-level log must omit the key
 * entirely rather than send `variantId: null`. durationMinutes/note are
 * `.nullable().optional()`, so omitting a null value is equally valid and
 * keeps a plain tap's body exactly as small as it was before the outbox.
 */
export interface CreateEntryInput {
  readonly id: string
  readonly trackerId: string
  readonly variantId: string | null
  readonly occurredAt: string
  /** the log sheet's optional duration/note. */
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

/**
 * One queued write. `id` is the client-generated UUIDv7 Entry id for both
 * kinds, which is what makes a replay idempotent: the server has either
 * already created that exact id or hasn't (docs/spec.md § API), and a
 * DELETE of an id that never landed is equally harmless.
 *
 * `status: 'dead'` is a 4xx dead-letter — the server rejected the write on
 * its merits, so retrying forever would only ever fail again. It stays in
 * the queue so the user can see it and discard or retry it deliberately
 * (build ticket 19), rather than vanishing.
 */
export interface OutboxItem {
  readonly id: string
  readonly kind: 'create' | 'delete'
  /** the POST body for a 'create'; null for a 'delete', which needs only the id. */
  readonly input: CreateEntryInput | null
  readonly attempts: number
  readonly status: 'pending' | 'dead'
  readonly queuedAt: string
}

const defaultPersistence: KeyValStore = { get, set, del }

let persistence: KeyValStore = defaultPersistence
let items: readonly OutboxItem[] = []
const listeners = new Set<() => void>()

/** serialises writes so two overlapping mutations can't persist out of order. */
let writeChain: Promise<void> = Promise.resolve()

/**
 * Ids with a request in the air right now. Deliberately in memory only, and
 * deliberately not an item `status`: it describes a live promise in this tab,
 * so persisting it would only ever leave a lie behind for the next launch to
 * read (docs/tech-stack.md § Outbox says the same about an `inflight` state).
 *
 * src/client/outbox/entryOutbox.ts sends from two code paths that can run
 * concurrently: a live write via `postEntry`/`deleteEntry`, and a queued item
 * a drain pass picks up. They collide by construction — a write is recorded
 * before it is attempted, so the enqueue that makes it durable notifies the
 * store, which wakes a drain pass (src/client/outbox/useOutboxDrain.ts
 * subscribes here), which finds a queued item nobody has sent yet and sends
 * it. Both requests then land, and whichever settles second finds the record
 * already gone and reads that as an undo — queueing a compensating delete
 * that erases the Entry that was just created. Claiming the id keeps exactly
 * one sender per item, which is also what makes `settleSentOutboxItem`'s "the
 * record vanished, so it was undone" inference safe.
 */
const inFlight = new Set<string>()

/** takes the send-claim on an id, or reports that someone else already holds it. */
export function claimOutboxItem(id: string): boolean {
  if (inFlight.has(id)) return false
  inFlight.add(id)
  return true
}

export function releaseOutboxItem(id: string): void {
  inFlight.delete(id)
}

function emit() {
  for (const listener of listeners) listener()
}

function persist(next: readonly OutboxItem[]): Promise<void> {
  writeChain = writeChain
    .then(() =>
      next.length === 0
        ? persistence.del(OUTBOX_STORAGE_KEY)
        : persistence.set(OUTBOX_STORAGE_KEY, JSON.stringify(next)),
    )
    // a failed IndexedDB write must not reject into the caller's log path:
    // the in-memory queue is still correct, and the next mutation rewrites
    // the whole list anyway.
    .catch(() => undefined)
  return writeChain
}

function commit(next: readonly OutboxItem[]): Promise<void> {
  items = next
  emit()
  return persist(next)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const outboxStore = {
  read: (): readonly OutboxItem[] => items,
  subscribe,

  /**
   * Replaces the whole queue. The drain loop uses this to write back the
   * result of a pass in one go; tests use it to reset module state.
   */
  setItems(next: readonly OutboxItem[]): Promise<void> {
    return commit(next)
  },
}

/** swaps the idb-keyval binding for an in-memory stand-in (tests only). */
export function setOutboxPersistence(store: KeyValStore = defaultPersistence): void {
  persistence = store
}

/**
 * Rehydrates the queue from IndexedDB. Called once at launch (build ticket
 * 17: Background Sync is unavailable on iOS, so the queue drains in the
 * foreground and has to be read back in first). Unparseable or absent
 * storage yields an empty queue rather than throwing — a corrupt outbox
 * must not stop the app from opening.
 */
export async function loadOutbox(): Promise<readonly OutboxItem[]> {
  let stored: string | undefined
  try {
    stored = await persistence.get(OUTBOX_STORAGE_KEY)
  } catch {
    stored = undefined
  }
  if (stored === undefined) return items

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return items
    items = parsed as readonly OutboxItem[]
    emit()
  } catch {
    // leave the in-memory queue as-is; the next mutation overwrites storage.
  }
  return items
}

/** appends a write to the back of the queue — the queue drains in order. */
export function enqueueOutboxItem(item: OutboxItem): Promise<void> {
  return commit([...items, item])
}

export function updateOutboxItem(id: string, patch: Partial<Omit<OutboxItem, 'id'>>): Promise<void> {
  return commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
}

export function removeOutboxItem(id: string): Promise<void> {
  return commit(items.filter((item) => item.id !== id))
}

/**
 * Retires an item whose request has just succeeded — normally by removing it,
 * since the server now has what the record was holding.
 *
 * The exception is a create whose record has vanished while its request was
 * in flight. That means undo: src/client/outbox/entryOutbox.ts drops a
 * still-queued create outright rather than queueing a compensating delete,
 * which is right for a write that never left the device — but the undo window
 * is five seconds and the request may already be on the wire. The Entry the user
 * undid has just been created after all, so the delete undo skipped gets
 * queued here. Returns whether it did, so a caller mid-drain knows there was
 * no create left to remove and a new item is now waiting.
 */
export async function settleSentOutboxItem(item: Pick<OutboxItem, 'id' | 'kind'>): Promise<boolean> {
  if (items.some((queued) => queued.id === item.id)) {
    await removeOutboxItem(item.id)
    return false
  }
  if (item.kind !== 'create') return false

  await enqueueOutboxItem({
    id: item.id,
    kind: 'delete',
    input: null,
    attempts: 0,
    status: 'pending',
    queuedAt: new Date().toISOString(),
  })
  return true
}

/**
 * Build ticket 19's retry-all: dead-lettered items go back to pending with
 * their attempt count reset, so the drain's backoff starts from the bottom
 * again rather than from wherever the item gave up. Already-pending items
 * are left exactly as they are — resetting a mid-backoff item's attempts
 * would restart a delay it is already partway through.
 */
export function retryAllOutboxItems(): Promise<void> {
  return commit(
    items.map((item) => (item.status === 'dead' ? { ...item, status: 'pending', attempts: 0 } : item)),
  )
}

export function useOutboxItems(): readonly OutboxItem[] {
  return useSyncExternalStore(subscribe, outboxStore.read, outboxStore.read)
}
