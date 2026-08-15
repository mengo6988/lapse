import { afterEach, describe, expect, it, vi } from 'vitest'
import * as clientModule from '../api/client'
import { fetchEntryCount } from './entryCount'

describe('fetchEntryCount', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the page length when there is a single page', async () => {
    const spy = vi
      .spyOn(clientModule, 'apiFetch')
      .mockResolvedValue({ entries: [{}, {}, {}], nextCursor: null })

    const count = await fetchEntryCount('tracker-1')

    expect(count).toBe(3)
    expect(spy).toHaveBeenCalledWith('/api/trackers/tracker-1/entries?limit=100')
  })

  it('returns 0 for a Tracker with no Entries', async () => {
    vi.spyOn(clientModule, 'apiFetch').mockResolvedValue({ entries: [], nextCursor: null })

    await expect(fetchEntryCount('tracker-1')).resolves.toBe(0)
  })

  it('follows nextCursor across pages and sums every page', async () => {
    const spy = vi
      .spyOn(clientModule, 'apiFetch')
      .mockResolvedValueOnce({ entries: new Array(100).fill({}), nextCursor: 'entry-100' })
      .mockResolvedValueOnce({ entries: new Array(37).fill({}), nextCursor: null })

    const count = await fetchEntryCount('tracker-1')

    expect(count).toBe(137)
    expect(spy).toHaveBeenNthCalledWith(1, '/api/trackers/tracker-1/entries?limit=100')
    expect(spy).toHaveBeenNthCalledWith(2, '/api/trackers/tracker-1/entries?limit=100&cursor=entry-100')
  })

  it('throws rather than looping forever when the cursor does not advance', async () => {
    vi.spyOn(clientModule, 'apiFetch').mockResolvedValue({
      entries: new Array(100).fill({}),
      nextCursor: 'stuck',
    })

    await expect(fetchEntryCount('tracker-1')).rejects.toThrow('cursor did not advance')
  })

  it('throws rather than looping forever when a page is empty but offers a cursor', async () => {
    vi.spyOn(clientModule, 'apiFetch').mockResolvedValue({ entries: [], nextCursor: 'entry-9' })

    await expect(fetchEntryCount('tracker-1')).rejects.toThrow('cursor did not advance')
  })

  it('throws when the response does not look like an entries page', async () => {
    vi.spyOn(clientModule, 'apiFetch').mockResolvedValue({ nonsense: true })

    await expect(fetchEntryCount('tracker-1')).rejects.toThrow()
  })
})
