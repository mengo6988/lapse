import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACTIVITY_PAGE_LIMIT, fetchActivityEntries } from './entriesApi'

const page = {
  entries: [
    { id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '2026-08-15T00:00:00.000Z' },
  ],
  nextCursor: 'e1',
}

describe('fetchActivityEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the cross-Tracker entries endpoint with the page limit, no cursor on the first page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => page })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchActivityEntries(null)

    expect(fetchMock).toHaveBeenCalledWith(`/api/entries?limit=${ACTIVITY_PAGE_LIMIT}`, expect.anything())
    expect(result).toEqual(page)
  })

  it('includes the cursor once one is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) })
    vi.stubGlobal('fetch', fetchMock)

    await fetchActivityEntries('e1')

    expect(fetchMock).toHaveBeenCalledWith(`/api/entries?limit=${ACTIVITY_PAGE_LIMIT}&cursor=e1`, expect.anything())
  })

  it('throws when the response does not match the expected wire shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nope: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchActivityEntries(null)).rejects.toThrow()
  })
})
