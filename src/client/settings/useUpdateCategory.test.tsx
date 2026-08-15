import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useUpdateCategory } from './useUpdateCategory'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const payload: BootstrapPayload = {
  categories: [{ id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' }],
  trackers: [],
}

describe('useUpdateCategory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes the input and merges the response into the bootstrap cache', async () => {
    const updated = { id: 'house', name: 'home', color: '#ffffff', createdAt: '2026-01-01T00:00:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useUpdateCategory(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'house', name: 'home', color: '#ffffff' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/categories/house',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'home', color: '#ffffff' }) }),
    )
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.categories).toEqual([updated])
  })

  it('rejects with the field errors on a 400 and leaves the cache untouched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['color'], message: 'expected a lowercase #rrggbb color' }] } }),
      }),
    )
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useUpdateCategory(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'house', color: 'not-a-color' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ fieldErrors: { color: 'expected a lowercase #rrggbb color' } })
    expect(queryClient.getQueryData(bootstrapQueryKey)).toEqual(payload)
  })
})
