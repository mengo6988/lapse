import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useUpdateTracker } from './useUpdateTracker'

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
      name: 'water the plants',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
}

describe('useUpdateTracker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes /api/trackers/:id and merges the response into the cache', async () => {
    const updated = { ...payload.trackers[0]!, name: 'water the ferns', variants: [] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useUpdateTracker(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 't1', name: 'water the ferns' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/trackers/t1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'water the ferns' }) }),
    )
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.trackers[0]?.name).toBe('water the ferns')
  })

  it('archives via { archived: true } and the cache reflects archivedAt', async () => {
    const archivedAt = '2026-08-15T00:00:00.000Z'
    const updated = { ...payload.trackers[0]!, archivedAt, variants: [] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated }))

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useUpdateTracker(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 't1', archived: true }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.trackers[0]?.archivedAt).toBe(archivedAt)
  })
})
