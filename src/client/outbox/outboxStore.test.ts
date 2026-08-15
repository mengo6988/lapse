import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyValStore } from '../query/storage'
import {
  OUTBOX_STORAGE_KEY,
  enqueueOutboxItem,
  loadOutbox,
  outboxStore,
  removeOutboxItem,
  retryAllOutboxItems,
  setOutboxPersistence,
  updateOutboxItem,
  type OutboxItem,
} from './outboxStore'

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    store: {
      get: async (key: string) => data.get(key),
      set: async (key: string, value: string) => {
        data.set(key, value)
      },
      del: async (key: string) => {
        data.delete(key)
      },
    } satisfies KeyValStore,
  }
}

function item(id: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id,
    kind: 'create',
    input: { id, trackerId: 'tracker-1', variantId: null, occurredAt: '2026-08-15T10:00:00.000Z' },
    attempts: 0,
    status: 'pending',
    queuedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  setOutboxPersistence(memoryStore().store)
  await outboxStore.setItems([])
})

describe('outboxStore', () => {
  it('appends queued writes in order', async () => {
    await enqueueOutboxItem(item('a'))
    await enqueueOutboxItem(item('b'))

    expect(outboxStore.read().map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('persists the queue so it survives a reload', async () => {
    const { data, store } = memoryStore()
    setOutboxPersistence(store)
    await enqueueOutboxItem(item('a', { attempts: 2 }))
    const persisted = data.get(OUTBOX_STORAGE_KEY)

    // a reload starts from an empty in-memory queue, then reads storage back.
    // the scratch store keeps that reset from clearing the key it is about to
    // rehydrate from.
    setOutboxPersistence(memoryStore().store)
    await outboxStore.setItems([])
    setOutboxPersistence(memoryStore({ [OUTBOX_STORAGE_KEY]: persisted ?? '' }).store)
    await loadOutbox()

    expect(outboxStore.read()).toEqual([item('a', { attempts: 2 })])
  })

  it('clears the stored key once the queue drains empty', async () => {
    const { data, store } = memoryStore()
    setOutboxPersistence(store)

    await enqueueOutboxItem(item('a'))
    expect(data.has(OUTBOX_STORAGE_KEY)).toBe(true)

    await removeOutboxItem('a')
    expect(data.has(OUTBOX_STORAGE_KEY)).toBe(false)
  })

  it('leaves the queue empty when storage holds something unparseable', async () => {
    const { store } = memoryStore({ [OUTBOX_STORAGE_KEY]: 'not json' })
    setOutboxPersistence(store)

    await expect(loadOutbox()).resolves.toEqual([])
    expect(outboxStore.read()).toEqual([])
  })

  it('patches one item without touching the rest', async () => {
    await enqueueOutboxItem(item('a'))
    await enqueueOutboxItem(item('b'))

    await updateOutboxItem('a', { attempts: 3, status: 'dead' })

    expect(outboxStore.read()[0]).toMatchObject({ id: 'a', attempts: 3, status: 'dead' })
    expect(outboxStore.read()[1]).toMatchObject({ id: 'b', attempts: 0, status: 'pending' })
  })

  it('retry-all revives dead items and leaves mid-backoff pending ones alone', async () => {
    await enqueueOutboxItem(item('dead', { status: 'dead', attempts: 4 }))
    await enqueueOutboxItem(item('pending', { status: 'pending', attempts: 2 }))

    await retryAllOutboxItems()

    expect(outboxStore.read()).toEqual([
      item('dead', { status: 'pending', attempts: 0 }),
      item('pending', { status: 'pending', attempts: 2 }),
    ])
  })

  it('notifies subscribers on every mutation', async () => {
    const listener = vi.fn()
    const unsubscribe = outboxStore.subscribe(listener)

    await enqueueOutboxItem(item('a'))
    await removeOutboxItem('a')
    unsubscribe()
    await enqueueOutboxItem(item('b'))

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps the in-memory queue when persistence throws', async () => {
    setOutboxPersistence({
      get: async () => undefined,
      set: async () => {
        throw new Error('quota exceeded')
      },
      del: async () => undefined,
    })

    await expect(enqueueOutboxItem(item('a'))).resolves.toBeUndefined()
    expect(outboxStore.read().map((entry) => entry.id)).toEqual(['a'])
  })
})
