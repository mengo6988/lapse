import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { QUERY_CACHE_KEY } from '../query/persister'
import type { KeyValStore } from '../query/storage'
import { useLogout } from './useLogout'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function createFakeKeyValStore(): KeyValStore {
  const map = new Map<string, string>()
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value)
    },
    del: async (key) => {
      map.delete(key)
    },
  }
}

const payload: BootstrapPayload = { categories: [], trackers: [] }

describe('useLogout', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to /api/auth/logout, clears the query cache, removes the idb snapshot, and marks the session unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const store = createFakeKeyValStore()
    await store.set(QUERY_CACHE_KEY, 'stale-snapshot')

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useLogout(store), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
    expect(queryClient.getQueryData(bootstrapQueryKey)).toBeUndefined()
    await expect(store.get(QUERY_CACHE_KEY)).resolves.toBeUndefined()
    expect(session.read()).toBe('unauthorized')
  })

  it('still clears local state when the network call fails — logout must never be blocked by being offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const store = createFakeKeyValStore()
    await store.set(QUERY_CACHE_KEY, 'stale-snapshot')

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    const { result } = renderHook(() => useLogout(store), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(bootstrapQueryKey)).toBeUndefined()
    await expect(store.get(QUERY_CACHE_KEY)).resolves.toBeUndefined()
    expect(session.read()).toBe('unauthorized')
  })
})
