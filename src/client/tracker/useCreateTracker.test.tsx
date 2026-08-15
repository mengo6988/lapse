import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { session } from '../auth/session'
import { useCreateTracker } from './useCreateTracker'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const emptyPayload: BootstrapPayload = { categories: [], trackers: [] }

describe('useCreateTracker', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs the input and appends the created Tracker to the bootstrap cache', async () => {
    const created = {
      id: 't1',
      name: 'water the plants',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      variants: [],
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => created })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, emptyPayload)
    const { result } = renderHook(() => useCreateTracker(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ name: 'water the plants' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/trackers',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'water the plants' }) }),
    )
    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers).toEqual([{ ...created, latestEntry: null }])
  })

  it('rejects with the field errors on a 400 and leaves the cache untouched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'required' }] } }),
      }),
    )
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, emptyPayload)
    const { result } = renderHook(() => useCreateTracker(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ name: '' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ fieldErrors: { name: 'required' } })
    expect(queryClient.getQueryData(bootstrapQueryKey)).toEqual(emptyPayload)
  })
})
