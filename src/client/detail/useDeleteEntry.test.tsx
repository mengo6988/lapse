import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { outboxStore, setOutboxPersistence } from '../outbox/outboxStore'
import type { KeyValStore } from '../query/storage'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { trackerEntriesQueryKey } from './useTrackerEntries'
import { useDeleteEntry } from './useDeleteEntry'

function memoryStore(): KeyValStore {
  const data = new Map<string, string>()
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => {
      data.set(key, value)
    },
    del: async (key) => {
      data.delete(key)
    },
  }
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const emptyBootstrap: BootstrapPayload = { categories: [], trackers: [] }

function seededQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, emptyBootstrap)
  queryClient.setQueryData(trackerEntriesQueryKey('t1'), {
    pages: [{ entries: [{ id: 'e1', trackerId: 't1', variantId: null, occurredAt: '', durationMinutes: null, note: null, createdAt: '' }], nextCursor: null }],
    pageParams: [null],
  })
  return queryClient
}

describe('useDeleteEntry', () => {
  beforeEach(async () => {
    setOutboxPersistence(memoryStore())
    await outboxStore.setItems([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    session.reset()
  })

  it('removes the Entry from the history cache and marks bootstrap stale immediately, and queues the delete in the outbox — offline never blocks it (audit-fixes decision 2)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const queryClient = seededQueryClient()

    const { result } = renderHook(() => useDeleteEntry(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'e1', trackerId: 't1' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<{ pages: { entries: unknown[] }[] }>(trackerEntriesQueryKey('t1'))?.pages[0]?.entries).toEqual([])
    expect(queryClient.getQueryState(bootstrapQueryKey)?.isInvalidated).toBe(true)
    expect(outboxStore.read()).toMatchObject([{ id: 'e1', kind: 'delete', input: null }])
  })

  it('drops a still-queued create for the same id instead of queueing a delete behind it', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await outboxStore.setItems([
      {
        id: 'e1',
        kind: 'create',
        input: { id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-15T00:00:00.000Z' },
        attempts: 0,
        status: 'pending',
        queuedAt: '2026-08-15T00:00:00.000Z',
      },
    ])
    const queryClient = seededQueryClient()

    const { result } = renderHook(() => useDeleteEntry(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'e1', trackerId: 't1' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(outboxStore.read()).toEqual([])
  })

  it('drops its own history-cache edit when the outbox rethrows, so the pages stop showing a delete nothing is holding', async () => {
    // a 401 is one of the two things the outbox rethrows rather than queueing.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    const queryClient = seededQueryClient()

    const { result } = renderHook(() => useDeleteEntry(), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'e1', trackerId: 't1' }))

    await waitFor(() => expect(queryClient.getQueryState(trackerEntriesQueryKey('t1'))?.isInvalidated).toBe(true))
    expect(outboxStore.read()).toEqual([])
  })
})
