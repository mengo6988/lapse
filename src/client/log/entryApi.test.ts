import { afterEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { deleteEntry, postEntry } from './entryApi'

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

describe('postEntry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    session.reset()
  })

  it('POSTs to /api/entries with the tracker-level shape when variantId is null', async () => {
    const created = {
      id: 'entry-1',
      trackerId: 't1',
      variantId: null,
      occurredAt: '2026-08-15T00:00:00.000Z',
      durationMinutes: null,
      note: null,
      createdAt: '2026-08-15T00:00:00.000Z',
    }
    const fetchMock = stubFetch({ status: 201, json: async () => created })

    const result = await postEntry({ id: 'entry-1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' })

    expect(result).toEqual(created)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ id: 'entry-1', trackerId: 't1', occurredAt: '2026-08-15T00:00:00.000Z' })
    expect(body).not.toHaveProperty('variantId')
  })

  it('includes variantId in the body when logging a Variant row', async () => {
    const fetchMock = stubFetch({
      status: 201,
      json: async () => ({
        id: 'entry-2',
        trackerId: 't1',
        variantId: 'v1',
        occurredAt: '2026-08-15T00:00:00.000Z',
        durationMinutes: null,
        note: null,
        createdAt: '2026-08-15T00:00:00.000Z',
      }),
    })

    await postEntry({ id: 'entry-2', trackerId: 't1', variantId: 'v1', occurredAt: '2026-08-15T00:00:00.000Z' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ id: 'entry-2', trackerId: 't1', variantId: 'v1', occurredAt: '2026-08-15T00:00:00.000Z' })
  })

  it('propagates a failed request as the shared ApiError, no queueing or retry of its own', async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })

    await expect(
      postEntry({ id: 'entry-3', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })

  // build ticket 13: the log sheet's optional duration/note ride the same
  // POST as a plain tap's occurredAt.
  it('includes durationMinutes and note in the body when given (build ticket 13)', async () => {
    const fetchMock = stubFetch({
      status: 201,
      json: async () => ({
        id: 'entry-4',
        trackerId: 't1',
        variantId: null,
        occurredAt: '2026-08-15T00:00:00.000Z',
        durationMinutes: 30,
        note: 'felt good',
        createdAt: '2026-08-15T00:00:00.000Z',
      }),
    })

    await postEntry({
      id: 'entry-4',
      trackerId: 't1',
      variantId: null,
      occurredAt: '2026-08-15T00:00:00.000Z',
      durationMinutes: 30,
      note: 'felt good',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      id: 'entry-4',
      trackerId: 't1',
      occurredAt: '2026-08-15T00:00:00.000Z',
      durationMinutes: 30,
      note: 'felt good',
    })
  })

  it('omits durationMinutes and note from the body when null or unset, matching the plain-tap shape', async () => {
    const fetchMock = stubFetch({ status: 201, json: async () => ({}) })

    await postEntry({
      id: 'entry-5',
      trackerId: 't1',
      variantId: null,
      occurredAt: '2026-08-15T00:00:00.000Z',
      durationMinutes: null,
      note: null,
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ id: 'entry-5', trackerId: 't1', occurredAt: '2026-08-15T00:00:00.000Z' })
  })
})

describe('deleteEntry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    session.reset()
  })

  it('DELETEs /api/entries/:id', async () => {
    const fetchMock = stubFetch({ status: 204, json: async () => null })

    await deleteEntry('entry-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/entries/entry-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('propagates a failed delete as the shared ApiError', async () => {
    stubFetch({ ok: false, status: 404, json: async () => ({ error: 'entry not found' }) })

    await expect(deleteEntry('missing')).rejects.toMatchObject({ name: 'ApiError', status: 404 })
  })
})
