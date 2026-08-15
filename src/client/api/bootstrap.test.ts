import { afterEach, describe, expect, it, vi } from 'vitest'
import * as clientModule from './client'
import { fetchBootstrap } from './bootstrap'

const validPayload = {
  categories: [],
  trackers: [
    {
      id: 'trk-1',
      name: 'vacuum',
      categoryId: null,
      thresholdDays: 14,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
}

describe('fetchBootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches /api/bootstrap and returns the parsed payload', async () => {
    const spy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(validPayload)

    const payload = await fetchBootstrap()

    expect(spy).toHaveBeenCalledWith('/api/bootstrap')
    expect(payload).toEqual(validPayload)
  })

  it('throws when the response does not match the expected shape', async () => {
    vi.spyOn(clientModule, 'apiFetch').mockResolvedValue({ nonsense: true })

    await expect(fetchBootstrap()).rejects.toThrow()
  })
})
