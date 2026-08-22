import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import type { KeyValStore } from '../query/storage'
import { deleteEntry, drainOutboxOnce, postEntry } from './entryOutbox'
import {
  outboxStore,
  removeOutboxItem,
  retryAllOutboxItems,
  setOutboxPersistence,
  type CreateEntryInput,
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

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({}),
    ...response,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubNetworkFailure() {
  const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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
    if (next === undefined) return Promise.reject(new Error('entryOutbox.test.ts: unexpected extra fetch call'))
    if (next === 'network-error') return Promise.reject(new Error('offline'))
    return Promise.resolve(next as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

/** a Promise the test controls the settlement of, for races against undo/re-entrancy. */
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

describe('postEntry', () => {
  it('is not raced by the drain the enqueue itself wakes: one POST, and no compensating delete', async () => {
    // useOutboxDrain subscribes to the store and drains on every change, so
    // the enqueue that makes the write durable also wakes a drain — which,
    // left alone, sends the same item a second time. Both sends then settle,
    // the second finds the record already gone, reads that as an undo, and
    // queues a compensating DELETE that erases the Entry that was just
    // created (found by the ticket 23 Playwright smoke).
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const unsubscribe = outboxStore.subscribe(() => {
      void drainOutboxOnce()
    })

    await postEntry({ id: 'raced-1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })
    // let any drain the settle woke run to completion.
    await new Promise((resolve) => setTimeout(resolve, 0))
    unsubscribe()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/entries')
    expect(outboxStore.read()).toEqual([])
  })

  it('records the write in the outbox before the request goes out, so a kill mid-request loses nothing', async () => {
    let releaseRequest!: (value: unknown) => void
    const inFlight = new Promise((resolve) => {
      releaseRequest = resolve
    })
    let queuedDuringRequest: readonly OutboxItem[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        queuedDuringRequest = outboxStore.read()
        return inFlight
      }),
    )

    const post = postEntry({ id: 'durable-1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })
    releaseRequest({ ok: true, status: 201, json: async () => ({}) })
    await post

    expect(queuedDuringRequest).toMatchObject([{ id: 'durable-1', kind: 'create', status: 'pending' }])
    // ...and success retires it again.
    expect(outboxStore.read()).toEqual([])
  })

  it('POSTs to /api/entries with the tracker-level shape when variantId is null', async () => {
    const fetchMock = stubFetch({
      status: 201,
      json: async () => ({
        id: 'entry-1',
        trackerId: 't1',
        variantId: null,
        occurredAt: '2026-08-15T00:00:00.000Z',
        durationMinutes: null,
        note: null,
        createdAt: '2026-08-15T00:00:00.000Z',
      }),
    })

    await postEntry({ id: 'entry-1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ id: 'entry-1', trackerId: 't1', occurredAt: '2026-08-15T00:00:00.000Z' })
    expect(body).not.toHaveProperty('variantId')
    // a successful write never touches the outbox.
    expect(outboxStore.read()).toEqual([])
  })

  it('includes variantId, durationMinutes and note in the body when given', async () => {
    const fetchMock = stubFetch({ status: 201, json: async () => ({}) })

    await postEntry({
      id: 'entry-2',
      trackerId: 't1',
      variantId: 'v1',
      occurredAt: '2026-08-15T00:00:00.000Z',
      durationMinutes: 30,
      note: 'felt good',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      id: 'entry-2',
      trackerId: 't1',
      variantId: 'v1',
      occurredAt: '2026-08-15T00:00:00.000Z',
      durationMinutes: 30,
      note: 'felt good',
    })
  })

  it('resolves (does not throw) and queues pending when the request never reaches the server', async () => {
    stubNetworkFailure()

    await expect(
      postEntry({ id: 'entry-3', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' }),
    ).resolves.toBeUndefined()

    // attempts: 1, not 0 — the failed live send counts as the first attempt, which
    // is what gives the drain a backoff to schedule instead of leaving the item
    // pending with nothing watching it.
    expect(outboxStore.read()).toMatchObject([{ id: 'entry-3', kind: 'create', status: 'pending', attempts: 1 }])
    const queued = outboxStore.read()[0] as OutboxItem
    expect(queued.input).toEqual({
      id: 'entry-3',
      trackerId: 't1',
      variantId: null,
      occurredAt: '2026-08-15T00:00:00.000Z',
    })
  })

  it('queues pending (not dead) on a 5xx — the server side of this may still recover', async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })

    await postEntry({ id: 'entry-4', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    expect(outboxStore.read()).toMatchObject([{ id: 'entry-4', status: 'pending' }])
  })

  it('bumps attempts on a retryable live failure, so the drain has a backoff to schedule', async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })

    await postEntry({ id: 'entry-4b', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    // left at 0, the item is pending with nothing scheduled and nothing watching it.
    expect(outboxStore.read()).toMatchObject([{ id: 'entry-4b', status: 'pending', attempts: 1 }])
  })

  it('does not bump attempts on a dead-lettered live failure — a 4xx is not retried', async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ error: 'bad tracker' }) })

    await postEntry({ id: 'entry-4c', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    expect(outboxStore.read()).toMatchObject([{ id: 'entry-4c', status: 'dead', attempts: 0 }])
  })

  it('queues dead-lettered on a non-401 4xx — the server rejected it on its merits', async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ error: 'bad tracker' }) })

    await postEntry({ id: 'entry-5', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    expect(outboxStore.read()).toMatchObject([{ id: 'entry-5', status: 'dead' }])
  })

  it('rethrows a 401 without queueing — the shell is about to show the login screen', async () => {
    stubFetch({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })

    await expect(
      postEntry({ id: 'entry-6', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 401 })

    expect(outboxStore.read()).toEqual([])
  })

  it('carries the client-generated id as the queued item id, so a replay is idempotent', async () => {
    stubNetworkFailure()

    await postEntry({ id: 'my-uuidv7-id', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    expect(outboxStore.read()[0]?.id).toBe('my-uuidv7-id')
  })
})

describe('deleteEntry', () => {
  it('DELETEs /api/entries/:id when nothing is queued for it', async () => {
    const fetchMock = stubFetch({ status: 204, json: async () => null })

    await deleteEntry('entry-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/entries/entry-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('undo of a still-queued create: removes the outbox item outright, no network call, no compensating delete', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await outboxStore.setItems([
      {
        id: 'queued-1',
        kind: 'create',
        input: { id: 'queued-1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' },
        attempts: 0,
        status: 'pending',
        queuedAt: '2026-08-15T00:00:00.000Z',
      },
    ])

    await deleteEntry('queued-1')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(outboxStore.read()).toEqual([])
  })

  it('undo of a dead-lettered create removes it outright too — the server rejected it, so there is nothing to delete', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await outboxStore.setItems([
      {
        id: 'rejected-1',
        kind: 'create',
        input: { id: 'rejected-1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' },
        attempts: 1,
        status: 'dead',
        queuedAt: '2026-08-15T00:00:00.000Z',
      },
    ])

    await deleteEntry('rejected-1')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(outboxStore.read()).toEqual([])
  })

  it('leaves other queued items alone when undoing one of them', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await outboxStore.setItems([
      {
        id: 'keep-me',
        kind: 'create',
        input: { id: 'keep-me', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' },
        attempts: 0,
        status: 'pending',
        queuedAt: '2026-08-15T00:00:00.000Z',
      },
      {
        id: 'undo-me',
        kind: 'create',
        input: { id: 'undo-me', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' },
        attempts: 0,
        status: 'pending',
        queuedAt: '2026-08-15T00:00:00.000Z',
      },
    ])

    await deleteEntry('undo-me')

    expect(outboxStore.read().map((item) => item.id)).toEqual(['keep-me'])
  })

  it('queues pending when the DELETE cannot reach the server', async () => {
    stubNetworkFailure()

    await expect(deleteEntry('entry-7')).resolves.toBeUndefined()

    expect(outboxStore.read()).toMatchObject([{ id: 'entry-7', kind: 'delete', status: 'pending', input: null }])
  })

  it('queues dead-lettered on a non-401 4xx delete failure', async () => {
    stubFetch({ ok: false, status: 404, json: async () => ({ error: 'entry not found' }) })

    await deleteEntry('entry-8')

    expect(outboxStore.read()).toMatchObject([{ id: 'entry-8', kind: 'delete', status: 'dead' }])
  })

  it('rethrows a 401 without queueing a delete', async () => {
    stubFetch({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })

    await expect(deleteEntry('entry-9')).rejects.toMatchObject({ name: 'ApiError', status: 401 })

    expect(outboxStore.read()).toEqual([])
  })
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
    // undo, landing mid-flight: deleteEntry above sees the create still
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
