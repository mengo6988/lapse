import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from '../home/fixtures'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { logWindowStore } from './logWindowStore'
import { useLogRow } from './useLogRow'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

/** a Promise the test controls the settlement of, to exercise races against undo/timers. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function serverEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'server-wont-be-used-id',
    trackerId: 't',
    variantId: null,
    occurredAt: '2026-08-15T00:00:00.000Z',
    durationMinutes: null,
    note: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('useLogRow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logWindowStore.closeSilently()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    session.reset()
  })

  it('applies the Entry optimistically before the POST resolves and opens the undo window', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const { promise, resolve } = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(promise))

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })

    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    const cachedTracker = cache?.trackers.find((t) => t.id === tracker.id)
    expect(cachedTracker?.latestEntry?.occurredAt).toBeTruthy()
    expect(logWindowStore.read()).toMatchObject({ kind: 'open', rowId: tracker.id, toastMessage: 'logged ✓' })

    resolve({ ok: true, status: 201, json: async () => serverEntry() } as Response)
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('POSTs with a client-generated UUIDv7 id and the tapped Tracker/Variant', async () => {
    const volvo = makeVariant({ name: 'volvo' })
    const tracker = makeTracker({ name: 'tyre pressure', thresholdDays: 30, variants: [volvo] })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: volvo.id }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/entries', expect.objectContaining({ method: 'POST' }))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.trackerId).toBe(tracker.id)
    expect(body.variantId).toBe(volvo.id)
    // UUIDv7 shape: version nibble '7', RFC 4122 variant nibble in [89ab].
    expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('undo before the POST resolves reverts the cache immediately, then deletes once the POST lands', async () => {
    const priorEntry = makeEntry({ occurredAt: isoDaysAgo(10) })
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7, latestEntry: priorEntry })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const { promise, resolve } = deferred<Response>()
    const fetchMock = vi.fn()
    fetchMock.mockReturnValueOnce(promise) // the POST
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))

    const openState = logWindowStore.read()
    if (openState.kind !== 'open') throw new Error('expected an open undo window')

    act(() => openState.onUndo())

    const revertedCache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(revertedCache?.trackers.find((t) => t.id === tracker.id)?.latestEntry).toEqual(priorEntry)
    expect(logWindowStore.read()).toEqual({ kind: 'closed' })

    // the DELETE only fires once the POST has actually landed.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => null })
    resolve({ ok: true, status: 201, json: async () => serverEntry() } as Response)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [deletePath, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(deletePath).toMatch(/^\/api\/entries\//)
    expect(deleteInit).toMatchObject({ method: 'DELETE' })
  })

  it('undo after the POST already succeeded deletes right away', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const openState = logWindowStore.read()
    if (openState.kind !== 'open') throw new Error('expected an open undo window')

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => null })
    act(() => openState.onUndo())
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(deleteInit).toMatchObject({ method: 'DELETE' })

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry).toBeNull()
  })

  it('a failed POST reverts the optimistic entry and surfaces a failure toast, no queueing', async () => {
    const priorEntry = makeEntry({ occurredAt: isoDaysAgo(10) })
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7, latestEntry: priorEntry })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) }))

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry).toEqual(priorEntry)
    expect(logWindowStore.read()).toEqual({ kind: 'message', toastMessage: "couldn't log — try again" })
  })

  it('undo requested while the POST is still pending skips the DELETE once it later fails to land', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const { promise, reject } = deferred<Response>()
    const fetchMock = vi.fn().mockReturnValue(promise)
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))

    const openState = logWindowStore.read()
    if (openState.kind !== 'open') throw new Error('expected an open undo window')
    act(() => openState.onUndo())

    reject(new Error('offline'))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // only the original POST attempt — undo never queues a DELETE for an Entry the server never received.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry).toBeNull()
  })

  it('undo requested while pending: once the POST lands, the follow-up DELETE firing but failing re-applies the Entry and warns', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const { promise, resolve } = deferred<Response>()
    const fetchMock = vi.fn()
    fetchMock.mockReturnValueOnce(promise) // the POST
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))

    const openState = logWindowStore.read()
    if (openState.kind !== 'open') throw new Error('expected an open undo window')
    act(() => openState.onUndo())

    // the POST lands after all (this attempt's own outcome is still 'pending' at undo time),
    // so submit()'s own continuation must notice undoRequested and attempt the DELETE — which fails.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
    resolve({ ok: true, status: 201, json: async () => serverEntry() } as Response)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry?.trackerId).toBe(tracker.id)
    expect(logWindowStore.read()).toEqual({ kind: 'message', toastMessage: "couldn't undo — offline" })
  })

  it('re-applies the Entry and shows "couldn\'t undo — offline" when the post-confirmation DELETE fails', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => serverEntry() })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const openState = logWindowStore.read()
    if (openState.kind !== 'open') throw new Error('expected an open undo window')
    act(() => openState.onUndo())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry?.trackerId).toBe(tracker.id)
    expect(logWindowStore.read()).toEqual({ kind: 'message', toastMessage: "couldn't undo — offline" })
  })

  it('a second tap (even the same row) opens a fresh window and makes the first log permanent', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() }))

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))
    const first = logWindowStore.read()
    if (first.kind !== 'open') throw new Error('expected an open undo window')

    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))
    const second = logWindowStore.read()
    if (second.kind !== 'open') throw new Error('expected an open undo window')

    expect(second.entryId).not.toBe(first.entryId)

    // the first entry's own undo handler is now stale — invoking it must not disturb the second window.
    act(() => first.onUndo())
    expect(logWindowStore.read()).toMatchObject({ kind: 'open', entryId: second.entryId })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  })
})

// build ticket 13's seam: logEntry(target, entryOverrides) widens logRow's
// LoggableRow with an optional occurredAt/durationMinutes/note, so the log
// sheet's backdated/annotated log reuses every choreography step below
// (freeze, optimistic write, POST, undo) unchanged.
describe('useLogRow entryOverrides (build ticket 13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logWindowStore.closeSilently()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    session.reset()
  })

  it('an omitted occurredAt still defaults to the actual moment of logging, exactly like a plain tap', async () => {
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'))
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }))
    await act(async () => {
      await Promise.resolve()
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.occurredAt).toBe('2026-08-15T12:00:00.000Z')
  })

  it('an explicit occurredAt override backdates the Entry, both optimistically and in the POST body', async () => {
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() =>
      result.current.logEntry(
        { trackerId: tracker.id, variantId: null },
        { occurredAt: '2026-08-14T09:00:00.000Z' },
      ),
    )

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry?.occurredAt).toBe('2026-08-14T09:00:00.000Z')

    await act(async () => {
      await Promise.resolve()
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.occurredAt).toBe('2026-08-14T09:00:00.000Z')
  })

  it('durationMinutes/note overrides land on the optimistic Entry and the POST body, neither affecting freeze/undo', async () => {
    const tracker = makeTracker({ name: 'run', thresholdDays: 7 })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() =>
      result.current.logEntry(
        { trackerId: tracker.id, variantId: null },
        { durationMinutes: 40, note: 'felt good' },
      ),
    )

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    const cachedEntry = cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry
    expect(cachedEntry?.durationMinutes).toBe(40)
    expect(cachedEntry?.note).toBe('felt good')
    expect(logWindowStore.read()).toMatchObject({ kind: 'open', toastMessage: 'logged ✓' })

    await act(async () => {
      await Promise.resolve()
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.durationMinutes).toBe(40)
    expect(body.note).toBe('felt good')
  })

  it('a failed POST for a backdated/annotated log reverts the optimistic entry and surfaces the same failure toast', async () => {
    const priorEntry = makeEntry({ occurredAt: isoDaysAgo(10) })
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7, latestEntry: priorEntry })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) }))

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() =>
      result.current.logEntry(
        { trackerId: tracker.id, variantId: null },
        { occurredAt: isoDaysAgo(1), note: 'backdated' },
      ),
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const cache = queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)
    expect(cache?.trackers.find((t) => t.id === tracker.id)?.latestEntry).toEqual(priorEntry)
    expect(logWindowStore.read()).toEqual({ kind: 'message', toastMessage: "couldn't log — try again" })
  })
})

// Backdating is what the log sheet exists for, so a logged Entry is routinely
// *older* than the row's existing latestEntry. `latestEntry` means latest —
// overwriting it with an older Entry would make the row claim it was last
// done longer ago than it was, and re-sort the list on that claim.
describe('useLogRow backdating behind the existing latest Entry (build ticket 13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logWindowStore.closeSilently()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    session.reset()
  })

  function backdatedBehindLatest() {
    const priorEntry = makeEntry({ occurredAt: isoDaysAgo(1) })
    const tracker = makeTracker({ name: 'vacuum', thresholdDays: 7, latestEntry: priorEntry })
    const payload: BootstrapPayload = { categories: [], trackers: [tracker] }
    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, payload)
    return { priorEntry, tracker, queryClient }
  }

  const latestOf = (queryClient: QueryClient, trackerId: string) =>
    queryClient
      .getQueryData<BootstrapPayload>(bootstrapQueryKey)
      ?.trackers.find((t) => t.id === trackerId)?.latestEntry

  it('leaves latestEntry alone when the backdated Entry is older than it', async () => {
    const { priorEntry, tracker, queryClient } = backdatedBehindLatest()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() =>
      result.current.logEntry({ trackerId: tracker.id, variantId: null }, { occurredAt: isoDaysAgo(5) }),
    )

    expect(latestOf(queryClient, tracker.id)).toEqual(priorEntry)
  })

  it('still creates the Entry server-side — it belongs in the history, it just is not what the row summarises', async () => {
    const { tracker, queryClient } = backdatedBehindLatest()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const backdated = isoDaysAgo(5)
    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }, { occurredAt: backdated }))
    await act(async () => {
      await Promise.resolve()
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string).occurredAt).toBe(backdated)
  })

  it('does not claim the row was just logged, since its last-done did not move', async () => {
    const { tracker, queryClient } = backdatedBehindLatest()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() }))

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() =>
      result.current.logEntry({ trackerId: tracker.id, variantId: null }, { occurredAt: isoDaysAgo(5) }),
    )

    const state = logWindowStore.read()
    expect(state.kind).toBe('open')
    // the toast and its undo still appear — the user did log something — but
    // no row settles green or reads "now", because none of them changed.
    if (state.kind === 'open') expect(state.rowId).toBeNull()
  })

  it('undo deletes the created Entry without disturbing the latestEntry it never replaced', async () => {
    const { priorEntry, tracker, queryClient } = backdatedBehindLatest()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() =>
      result.current.logEntry({ trackerId: tracker.id, variantId: null }, { occurredAt: isoDaysAgo(5) }),
    )
    await act(async () => {
      await Promise.resolve()
    })

    const state = logWindowStore.read()
    if (state.kind === 'open') act(() => state.onUndo())
    await act(async () => {
      await Promise.resolve()
    })

    expect(latestOf(queryClient, tracker.id)).toEqual(priorEntry)
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE')).toBe(true)
  })

  it('a backdated Entry newer than the existing latest does still become the latest', () => {
    const { tracker, queryClient } = backdatedBehindLatest()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => serverEntry() }))

    // an hour ago, against a latest from a full day ago.
    const backdated = new Date(Date.now() - 3_600_000).toISOString()
    const { result } = renderHook(() => useLogRow(), { wrapper: wrapper(queryClient) })
    act(() => result.current.logEntry({ trackerId: tracker.id, variantId: null }, { occurredAt: backdated }))

    expect(latestOf(queryClient, tracker.id)?.occurredAt).toBe(backdated)
  })
})
