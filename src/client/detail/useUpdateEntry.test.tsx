import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { trackerEntriesQueryKey } from './useTrackerEntries'
import { useUpdateEntry } from './useUpdateEntry'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const emptyBootstrap: BootstrapPayload = { categories: [], trackers: [] }

describe('useUpdateEntry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes /api/entries/:id, replaces the Entry in the cached history pages, and invalidates bootstrap', async () => {
    const updated = { id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z', durationMinutes: 30, note: 'updated', createdAt: '' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(bootstrapQueryKey, emptyBootstrap)
    queryClient.setQueryData(trackerEntriesQueryKey('t1'), {
      pages: [{ entries: [{ id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '' }], nextCursor: null }],
      pageParams: [null],
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateEntry(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'e1', trackerId: 't1', durationMinutes: 30, note: 'updated' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/entries/e1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ durationMinutes: 30, note: 'updated' }) }),
    )
    expect(queryClient.getQueryData<{ pages: { entries: { note: string | null }[] }[] }>(trackerEntriesQueryKey('t1'))?.pages[0]?.entries[0]?.note).toBe('updated')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bootstrapQueryKey })
  })
})
