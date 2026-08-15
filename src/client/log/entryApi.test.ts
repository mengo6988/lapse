import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { outboxStore, setOutboxPersistence, type OutboxItem } from '../outbox/outboxStore'
import type { KeyValStore } from '../query/storage'
import { deleteEntry, postEntry } from './entryApi'

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

beforeEach(async () => {
  setOutboxPersistence(memoryStore())
  await outboxStore.setItems([])
})

afterEach(() => {
  vi.unstubAllGlobals()
  session.reset()
})

describe('postEntry', () => {
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

    expect(outboxStore.read()).toMatchObject([{ id: 'entry-3', kind: 'create', status: 'pending', attempts: 0 }])
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
