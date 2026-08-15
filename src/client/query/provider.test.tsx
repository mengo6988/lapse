import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { AppQueryProvider } from './provider'
import { createQueryPersister } from './persister'
import type { KeyValStore } from './storage'
import { useBootstrapQuery } from './useBootstrap'

const knownPayload = {
  categories: [],
  trackers: [
    {
      id: 'trk-known',
      name: 'from cache',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
}

const serverPayload = {
  categories: [],
  trackers: [
    {
      id: 'trk-server',
      name: 'from server',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
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

/** Seeds a fake IndexedDB-shaped store with a persisted snapshot, exactly as
 * a previous app session would have left it. */
async function seedPersistedSnapshot(store: KeyValStore, payload: unknown) {
  const seedClient = new QueryClient()
  seedClient.setQueryData(['bootstrap'], payload)
  await persistQueryClientSave({ queryClient: seedClient, persister: createQueryPersister(store) })
}

function stubFetch(response: { status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
    }),
  )
}

function Probe() {
  const { data, isLoading, error } = useBootstrapQuery()
  if (error) return <div>query error</div>
  if (isLoading) return <div>loading</div>
  return <div>tracker: {data?.trackers[0]?.name}</div>
}

describe('AppQueryProvider', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a persisted snapshot without waiting on the network', async () => {
    const store = createFakeKeyValStore()
    await seedPersistedSnapshot(store, knownPayload)
    // A fetch that never resolves proves the render did not depend on it.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    render(
      <AppQueryProvider store={store}>
        <Probe />
      </AppQueryProvider>,
    )

    await screen.findByText('tracker: from cache')
  })

  it('recovers fully from the bootstrap fetch when client storage is empty (disposable storage)', async () => {
    const emptyStore = createFakeKeyValStore()
    stubFetch({ status: 200, body: serverPayload })

    render(
      <AppQueryProvider store={emptyStore}>
        <Probe />
      </AppQueryProvider>,
    )

    await screen.findByText('tracker: from server')
  })

  it('marks the session unauthorized on a 401 instead of failing silently', async () => {
    const emptyStore = createFakeKeyValStore()
    stubFetch({ status: 401, body: { error: 'unauthorized' } })

    render(
      <AppQueryProvider store={emptyStore}>
        <Probe />
      </AppQueryProvider>,
    )

    await waitFor(() => expect(session.read()).toBe('unauthorized'))
    await screen.findByText('query error')
  })
})
