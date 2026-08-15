import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useCreateCategory } from './useCreateCategory'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const emptyPayload: BootstrapPayload = { categories: [], trackers: [] }

describe('useCreateCategory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs the input and appends the created Category to the bootstrap cache', async () => {
    const created = { id: 'health', name: 'health', color: '#f38ba8', createdAt: '2026-08-15T00:00:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => created })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, emptyPayload)
    const { result } = renderHook(() => useCreateCategory(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ name: 'health', color: '#f38ba8' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/categories',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'health', color: '#f38ba8' }) }),
    )
    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.categories).toEqual([created])
  })
})
