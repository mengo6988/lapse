import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useHardDeleteTracker } from './useHardDeleteTracker'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const payload: BootstrapPayload = {
  categories: [],
  trackers: [
    {
      id: 't1',
      name: 'ancient chore',
      categoryId: null,
      thresholdDays: null,
      archivedAt: '2026-08-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
}

describe('useHardDeleteTracker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('DELETEs /api/trackers/:id and drops it from the cache on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useHardDeleteTracker(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate('t1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/trackers/t1', expect.objectContaining({ method: 'DELETE' }))
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.trackers).toEqual([])
  })

  it('leaves the cache untouched on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'tracker must be archived before it can be deleted' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useHardDeleteTracker(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate('t1'))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.trackers).toHaveLength(1)
  })
})
