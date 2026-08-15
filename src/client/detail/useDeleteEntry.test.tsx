import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { trackerEntriesQueryKey } from './useTrackerEntries'
import { useDeleteEntry } from './useDeleteEntry'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const emptyBootstrap: BootstrapPayload = { categories: [], trackers: [] }

describe('useDeleteEntry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('DELETEs /api/entries/:id, removes the Entry from the cached history pages, and invalidates bootstrap', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(bootstrapQueryKey, emptyBootstrap)
    queryClient.setQueryData(trackerEntriesQueryKey('t1'), {
      pages: [{ entries: [{ id: 'e1', trackerId: 't1', variantId: null, occurredAt: '', durationMinutes: null, note: null, createdAt: '' }], nextCursor: null }],
      pageParams: [null],
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteEntry(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'e1', trackerId: 't1' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/entries/e1', expect.objectContaining({ method: 'DELETE' }))
    expect(queryClient.getQueryData<{ pages: { entries: unknown[] }[] }>(trackerEntriesQueryKey('t1'))?.pages[0]?.entries).toEqual([])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bootstrapQueryKey })
  })
})
