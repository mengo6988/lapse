import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tracker } from '../api'
import { EntryHistoryList } from './EntryHistoryList'

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

const tracker: Tracker = {
  id: 't1',
  name: 'tyre pressure',
  categoryId: null,
  thresholdDays: null,
  archivedAt: null,
  createdAt: '',
  latestEntry: null,
  variants: [{ id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null }],
}

const firstPage = {
  entries: [
    { id: 'e1', trackerId: 't1', variantId: 'v1', occurredAt: new Date(2026, 7, 15, 9, 0, 0).toISOString(), durationMinutes: null, note: null, createdAt: '' },
  ],
  nextCursor: 'e1',
}

const secondPage = {
  entries: [
    { id: 'e2', trackerId: 't1', variantId: null, occurredAt: new Date(2026, 7, 1, 9, 0, 0).toISOString(), durationMinutes: null, note: null, createdAt: '' },
  ],
  nextCursor: null,
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EntryHistoryList trackerId="t1" tracker={tracker} now={new Date(2026, 7, 15, 12, 0, 0)} onOpenEntry={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('EntryHistoryList', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a loading state, then the first page newest-first', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => firstPage })
    vi.stubGlobal('fetch', fetchMock)

    renderList()

    expect(screen.getByText('loading history…')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('list')).toBeTruthy())
  })

  it('labels a Variant Entry with its Variant name, and a tracker-level Entry as such', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => firstPage })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => secondPage })
    vi.stubGlobal('fetch', fetchMock)

    renderList()
    await screen.findByText('volvo')

    act(() => FakeIntersectionObserver.instances[0]!.trigger(true))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('no variant')).toBeTruthy()
  })

  it('loads the next page when the sentinel intersects — cursor pagination via infinite scroll', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => firstPage })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => secondPage })
    vi.stubGlobal('fetch', fetchMock)

    renderList()
    await screen.findByText('volvo')

    act(() => FakeIntersectionObserver.instances[0]!.trigger(true))

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/trackers/t1/entries?limit=20&cursor=e1', expect.anything()))
  })

  it('shows an empty message when the Tracker has no Entries at all', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) })
    vi.stubGlobal('fetch', fetchMock)

    renderList()

    expect(await screen.findByText('no entries yet')).toBeTruthy()
  })

  it('shows a distinct error state, not the muted empty-state styling, when the history fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
    vi.stubGlobal('fetch', fetchMock)

    renderList()

    const message = await screen.findByText("couldn't load history — try again")
    expect(message.className).toBe('detail-history__error')
    expect(message.className).not.toBe('detail-not-found')
    expect(message.className).not.toBe('detail-empty')
  })
})
