import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useDeleteCategory } from './useDeleteCategory'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const payload: BootstrapPayload = {
  categories: [{ id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' }],
  trackers: [
    {
      id: 't1',
      name: 'water the plants',
      categoryId: 'house',
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
}

describe('useDeleteCategory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('DELETEs /api/categories/:id, drops it, and uncategorises its Trackers in the cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload.categories[0] })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useDeleteCategory(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate('house'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/categories/house', expect.objectContaining({ method: 'DELETE' }))
    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.categories).toEqual([])
    expect(cache?.trackers[0]?.categoryId).toBeNull()
  })
})
