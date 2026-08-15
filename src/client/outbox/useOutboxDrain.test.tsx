import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import type { CreateEntryInput } from '../log/entryApi'
import type { KeyValStore } from '../query/storage'
import { BACKOFF_BASE_MS } from './backoff'
import { enqueueOutboxItem, outboxStore, setOutboxPersistence, OUTBOX_STORAGE_KEY, type OutboxItem } from './outboxStore'
import { useOutboxDrain } from './useOutboxDrain'

function memoryStore(initial: Record<string, string> = {}): { data: Map<string, string>; store: KeyValStore } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    store: {
      get: async (key) => data.get(key),
      set: async (key, value) => {
        data.set(key, value)
      },
      del: async (key) => {
        data.delete(key)
      },
    },
  }
}

function createItem(id: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  const input: CreateEntryInput = { id, trackerId: 'tracker-1', variantId: null, occurredAt: '2026-08-15T10:00:00.000Z' }
  return {
    id,
    kind: 'create',
    input,
    attempts: 0,
    status: 'pending',
    queuedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  }
}

type QueuedResponse = { ok: boolean; status: number; json: () => Promise<unknown> } | 'network-error'

function ok(body: unknown = {}, status = 201): QueuedResponse {
  return { ok: true, status, json: async () => body }
}

function stubSequentialFetch(responses: QueuedResponse[]) {
  const fetchMock = vi.fn(() => {
    const next = responses.shift()
    if (next === undefined) return Promise.reject(new Error('useOutboxDrain.test.tsx: unexpected extra fetch call'))
    if (next === 'network-error') return Promise.reject(new Error('offline'))
    return Promise.resolve(next as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

beforeEach(async () => {
  setOutboxPersistence(memoryStore().store)
  await outboxStore.setItems([])
  setVisibility('visible')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  session.reset()
})

describe('useOutboxDrain', () => {
  it('rehydrates the queue from storage on mount, then drains it', async () => {
    const persisted = JSON.stringify([createItem('rehydrated')])
    setOutboxPersistence(memoryStore({ [OUTBOX_STORAGE_KEY]: persisted }).store)
    const fetchMock = stubSequentialFetch([ok({ id: 'rehydrated' })])

    const { unmount } = renderHook(() => useOutboxDrain())

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(outboxStore.read()).toEqual([]))
    unmount()
  })

  it('drains again when an item is enqueued while mounted', async () => {
    const fetchMock = stubSequentialFetch([ok({ id: 'later' })])
    const { unmount } = renderHook(() => useOutboxDrain())
    await waitFor(() => expect(outboxStore.read()).toEqual([]))

    await enqueueOutboxItem(createItem('later'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(outboxStore.read()).toEqual([]))
    unmount()
  })

  it('drains again on the "online" event', async () => {
    stubSequentialFetch(['network-error'])
    await outboxStore.setItems([createItem('a')])
    const { unmount } = renderHook(() => useOutboxDrain())
    await waitFor(() => expect(outboxStore.read()).toEqual([createItem('a', { attempts: 1 })]))

    stubSequentialFetch([ok({ id: 'a' })])
    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(outboxStore.read()).toEqual([]))
    unmount()
  })

  it('drains again when visibilitychange fires with the document visible', async () => {
    stubSequentialFetch(['network-error'])
    await outboxStore.setItems([createItem('a')])
    const { unmount } = renderHook(() => useOutboxDrain())
    await waitFor(() => expect(outboxStore.read()).toEqual([createItem('a', { attempts: 1 })]))

    stubSequentialFetch([ok({ id: 'a' })])
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(outboxStore.read()).toEqual([]))
    unmount()
  })

  it('does not drain on a visibilitychange to hidden', async () => {
    const fetchMock = stubSequentialFetch([ok({ id: 'a' })])
    await outboxStore.setItems([createItem('a')])
    const { unmount } = renderHook(() => useOutboxDrain())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(outboxStore.read()).toEqual([]))

    fetchMock.mockClear()
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetchMock).not.toHaveBeenCalled()
    unmount()
  })

  it('schedules the next attempt with backoff(attempts) after a retryable failure, and drains again once it elapses', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1) // deterministic upper-bound delay
    stubSequentialFetch(['network-error'])
    await outboxStore.setItems([createItem('a')])

    const { unmount } = renderHook(() => useOutboxDrain())
    await vi.waitFor(() => expect(outboxStore.read()).toEqual([createItem('a', { attempts: 1 })]))

    stubSequentialFetch([ok({ id: 'a' })])
    // attempts is now 1, so backoff(1, () => 1) === BACKOFF_BASE_MS * 2.
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 2)

    await vi.waitFor(() => expect(outboxStore.read()).toEqual([]))
    unmount()
  })

  it('cleans up its timer and listeners on unmount: no further drain fires afterward', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const fetchMock = stubSequentialFetch(['network-error'])
    await outboxStore.setItems([createItem('a')])

    const { unmount } = renderHook(() => useOutboxDrain())
    await vi.waitFor(() => expect(outboxStore.read()).toEqual([createItem('a', { attempts: 1 })]))

    unmount()
    fetchMock.mockClear()

    // the scheduled backoff timer must not still fire post-unmount...
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 4)
    expect(fetchMock).not.toHaveBeenCalled()

    // ...nor must the online/visibilitychange listeners still be attached.
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
