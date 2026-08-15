import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import type { CreateEntryInput } from '../log/entryApi'
import type { KeyValStore } from '../query/storage'
import { drainOutboxOnce } from './drainOutbox'
import {
  outboxStore,
  removeOutboxItem,
  retryAllOutboxItems,
  setOutboxPersistence,
  type OutboxItem,
} from './outboxStore'

function memoryStore(): KeyValStore {
  const data = new Map<string, string>()
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => {
      data.set(key, value)
    },
    del: async (key) => {
      data.delete(key)
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

function deleteItem(id: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id,
    kind: 'delete',
    input: null,
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

function fail(status: number, body: unknown = {}): QueuedResponse {
  return { ok: false, status, json: async () => body }
}

function stubSequentialFetch(responses: QueuedResponse[]) {
  const calls: Array<[string, RequestInit | undefined]> = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push([url, init])
    const next = responses.shift()
    if (next === undefined) return Promise.reject(new Error('drainOutbox.test.ts: unexpected extra fetch call'))
    if (next === 'network-error') return Promise.reject(new Error('offline'))
    return Promise.resolve(next as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

/** a Promise the test controls the settlement of, for the re-entrancy test. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(async () => {
  setOutboxPersistence(memoryStore())
  await outboxStore.setItems([])
})

afterEach(() => {
  vi.unstubAllGlobals()
  session.reset()
})

describe('drainOutboxOnce', () => {
  it('drains items serially, oldest first', async () => {
    const { fetchMock } = stubSequentialFetch([ok({ id: 'a' }), ok({ id: 'b' })])
    await outboxStore.setItems([createItem('a'), createItem('b')])

    const result = await drainOutboxOnce()

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/entries')
    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string).id).toBe('a')
    expect(JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string).id).toBe('b')
    expect(outboxStore.read()).toEqual([])
    expect(result).toEqual({ retryAfterAttempts: null })
  })

  it('sends a delete item as DELETE /api/entries/:id', async () => {
    const { fetchMock } = stubSequentialFetch([ok(null, 204)])
    await outboxStore.setItems([deleteItem('to-delete')])

    await drainOutboxOnce()

    expect(fetchMock).toHaveBeenCalledWith('/api/entries/to-delete', expect.objectContaining({ method: 'DELETE' }))
    expect(outboxStore.read()).toEqual([])
  })

  it('stops the pass on a network failure, bumping attempts and leaving items behind it untouched', async () => {
    const { fetchMock } = stubSequentialFetch(['network-error'])
    await outboxStore.setItems([createItem('a'), createItem('b')])

    const result = await drainOutboxOnce()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ retryAfterAttempts: 1 })
    expect(outboxStore.read()).toEqual([createItem('a', { attempts: 1 }), createItem('b')])
  })

  it('stops the pass on a 5xx the same way it stops on a network failure', async () => {
    const { fetchMock } = stubSequentialFetch([fail(503)])
    await outboxStore.setItems([createItem('a', { attempts: 2 })])

    const result = await drainOutboxOnce()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ retryAfterAttempts: 3 })
    expect(outboxStore.read()).toEqual([createItem('a', { attempts: 3 })])
  })

  it('dead-letters a non-401 4xx item and continues to the next one', async () => {
    const { fetchMock } = stubSequentialFetch([fail(400), ok({ id: 'b' })])
    await outboxStore.setItems([createItem('a'), createItem('b')])

    const result = await drainOutboxOnce()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(outboxStore.read()).toEqual([createItem('a', { status: 'dead' })])
    expect(result).toEqual({ retryAfterAttempts: null })
  })

  it('stops the whole pass on a 401 without dead-lettering or bumping attempts', async () => {
    const { fetchMock } = stubSequentialFetch([fail(401)])
    await outboxStore.setItems([createItem('a'), createItem('b')])

    const result = await drainOutboxOnce()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ retryAfterAttempts: null })
    expect(outboxStore.read()).toEqual([createItem('a'), createItem('b')])
  })

  it('skips dead-lettered items without sending them, but still sends the pending item behind it', async () => {
    const { fetchMock } = stubSequentialFetch([ok({ id: 'b' })])
    await outboxStore.setItems([createItem('a', { status: 'dead' }), createItem('b')])

    await drainOutboxOnce()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outboxStore.read()).toEqual([createItem('a', { status: 'dead' })])
  })

  it('guards against overlapping passes: a re-entrant call while one is in flight does not send twice', async () => {
    const { promise, resolve } = deferred<Response>()
    const fetchMock = vi.fn().mockReturnValue(promise)
    vi.stubGlobal('fetch', fetchMock)
    await outboxStore.setItems([createItem('a')])

    const firstPass = drainOutboxOnce()
    const secondPass = await drainOutboxOnce()

    expect(secondPass).toEqual({ retryAfterAttempts: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolve({ ok: true, status: 201, json: async () => ({}) } as Response)
    await firstPass

    expect(outboxStore.read()).toEqual([])
  })

  it('sends the compensating delete when undo drops a create whose POST was already in flight', async () => {
    const { promise, resolve } = deferred<Response>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(promise)
      .mockResolvedValue({ ok: true, status: 204, json: async () => null } as Response)
    vi.stubGlobal('fetch', fetchMock)
    await outboxStore.setItems([createItem('a')])

    const pass = drainOutboxOnce()
    // undo, landing mid-flight: entryApi's deleteEntry sees the create still
    // queued and drops it, never sending a DELETE — but this POST is already
    // on the wire and about to succeed.
    await removeOutboxItem('a')
    resolve({ ok: true, status: 201, json: async () => ({}) } as Response)
    await pass

    expect(fetchMock).toHaveBeenCalledWith('/api/entries/a', expect.objectContaining({ method: 'DELETE' }))
    expect(outboxStore.read()).toEqual([])
  })

  it('runs another pass when a trigger arrives mid-pass, so a mid-pass retry-all is not swallowed', async () => {
    const { promise, resolve } = deferred<Response>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(promise)
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)
    // the dead item sits *ahead* of the pending one: a dead-letter accumulates
    // at the front of the queue while newer writes drain past it, so that is
    // where retry-all finds it.
    await outboxStore.setItems([createItem('b', { status: 'dead' }), createItem('a')])

    const pass = drainOutboxOnce()
    // build ticket 19's retry all, tapped while a pass happens to be running:
    // 'b' goes back to pending, and the store change that would normally wake
    // the drain arrives as a call the re-entrancy guard turns away.
    await retryAllOutboxItems()
    await drainOutboxOnce()
    resolve({ ok: true, status: 201, json: async () => ({}) } as Response)
    await pass

    expect(outboxStore.read()).toEqual([])
  })
})
