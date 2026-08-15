import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTrackerEntries, HISTORY_PAGE_LIMIT } from './entriesApi'

const page = {
  entries: [
    { id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '2026-08-15T00:00:00.000Z' },
  ],
  nextCursor: 'e1',
}

describe('fetchTrackerEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the tracker history endpoint with the page limit, no cursor on the first page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => page })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchTrackerEntries('t1', null)

    expect(fetchMock).toHaveBeenCalledWith(`/api/trackers/t1/entries?limit=${HISTORY_PAGE_LIMIT}`, expect.anything())
    expect(result).toEqual(page)
  })

  it('includes the cursor once one is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) })
    vi.stubGlobal('fetch', fetchMock)

    await fetchTrackerEntries('t1', 'e1')

    expect(fetchMock).toHaveBeenCalledWith(`/api/trackers/t1/entries?limit=${HISTORY_PAGE_LIMIT}&cursor=e1`, expect.anything())
  })

  it('throws when the response does not match the expected wire shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nope: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTrackerEntries('t1', null)).rejects.toThrow()
  })
})
