import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useUpdateVariant } from './useUpdateVariant'

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
      name: 'tyre pressure',
      categoryId: null,
      thresholdDays: 30,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [{ id: 'v1', name: 'front', thresholdDays: 20, latestEntry: null }],
    },
  ],
}

describe('useUpdateVariant', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes /api/variants/:id and merges the rename/threshold change', async () => {
    const updated = { id: 'v1', trackerId: 't1', name: 'front (renamed)', thresholdDays: null, deletedAt: null, createdAt: '' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useUpdateVariant(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ variantId: 'v1', name: 'front (renamed)', thresholdDays: null }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/variants/v1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'front (renamed)', thresholdDays: null }) }),
    )
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.trackers[0]?.variants[0]).toEqual({
      id: 'v1',
      name: 'front (renamed)',
      thresholdDays: null,
      latestEntry: null,
    })
  })
})
