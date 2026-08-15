import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackerEntriesQueryKey, useTrackerEntries } from './useTrackerEntries'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const firstPage = { entries: [{ id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '' }], nextCursor: 'e1' }
const secondPage = { entries: [{ id: 'e2', trackerId: 't1', variantId: null, occurredAt: '2026-08-01T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '' }], nextCursor: null }

describe('trackerEntriesQueryKey', () => {
  it('scopes the query key by trackerId', () => {
    expect(trackerEntriesQueryKey('t1')).toEqual(['trackerEntries', 't1'])
    expect(trackerEntriesQueryKey('t1')).not.toEqual(trackerEntriesQueryKey('t2'))
  })
})

describe('useTrackerEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the first page, then a subsequent page via fetchNextPage using the returned cursor', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => firstPage })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => secondPage })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useTrackerEntries('t1'), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages).toEqual([firstPage])
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.pages).toEqual([firstPage, secondPage]))
    expect(result.current.hasNextPage).toBe(false)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/trackers/t1/entries?limit=20&cursor=e1', expect.anything())
  })
})
