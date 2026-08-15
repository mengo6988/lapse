import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { activityEntriesQueryKey, useActivityEntries } from './useActivityEntries'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const firstPage = { entries: [{ id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '' }], nextCursor: 'e1' }
const secondPage = { entries: [{ id: 'e2', trackerId: 't2', variantId: null, occurredAt: '2026-08-01T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '' }], nextCursor: null }

describe('activityEntriesQueryKey', () => {
  it('is a stable key not scoped to any single Tracker', () => {
    expect(activityEntriesQueryKey).toEqual(['activityEntries'])
  })
})

describe('useActivityEntries', () => {
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
    const { result } = renderHook(() => useActivityEntries(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages).toEqual([firstPage])
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.pages).toEqual([firstPage, secondPage]))
    expect(result.current.hasNextPage).toBe(false)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/entries?limit=50&cursor=e1', expect.anything())
  })
})
