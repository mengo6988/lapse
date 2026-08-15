import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useAddVariant } from './useAddVariant'

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
      variants: [],
    },
  ],
}

describe('useAddVariant', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs /api/trackers/:id/variants and appends the Variant to its parent', async () => {
    const created = { id: 'v1', trackerId: 't1', name: 'front', thresholdDays: null, deletedAt: null, createdAt: '' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => created })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useAddVariant(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ trackerId: 't1', name: 'front' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/trackers/t1/variants',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'front' }) }),
    )
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.trackers[0]?.variants).toEqual([
      { id: 'v1', name: 'front', thresholdDays: null, latestEntry: null },
    ])
  })
})
