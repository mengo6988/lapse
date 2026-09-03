import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { logSheetStore } from '../log/logSheetStore'
import { logWindowStore } from '../log/logWindowStore'
import { EXIT_DURATION_MS } from '../shell/useExitTransition'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from '../home/fixtures'
import { HomeRoute } from './HomeRoute'

// jsdom has no PointerEvent constructor — see
// src/client/detail/SwipeRevealRow.test.tsx's firePointerEvent for why a
// MouseEvent dispatched under the pointer* type name is a faithful stand-in.
function firePointerEvent(target: Element, type: string, clientX: number, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

/**
 * seeds the query cache directly (fixture bootstrap data) instead of
 * hitting the network — `staleTime: Infinity` on this test client keeps
 * TanStack Query from firing a background refetch against the real
 * `fetchBootstrap`, which would try to hit a server that isn't running.
 */
function renderHome(payload: BootstrapPayload) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(bootstrapQueryKey, payload)

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomeRoute />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HomeRoute', () => {
  it('shows the top-3 rows by urgency in the slipping section, per docs/design.md\'s worked example', () => {
    const hvac = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74) }),
    })
    const volvo = makeVariant({ name: 'volvo', latestEntry: makeEntry({ occurredAt: isoDaysAgo(34) }) })
    const crv = makeVariant({
      name: 'crv',
      thresholdDays: 7, // crv's own Threshold overrides the tracker's 30d
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(6) }),
    })
    const tyres = makeTracker({ name: 'tyre pressure', thresholdDays: 30, variants: [volvo, crv] })
    const dentist = makeTracker({
      name: 'dentist checkup',
      thresholdDays: 180,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(120) }), // fresh — not slipping
    })

    renderHome({ categories: [], trackers: [hvac, tyres, dentist] })

    expect(screen.getByText('slipping')).toBeTruthy()
    expect(screen.getByText('change hvac filter')).toBeTruthy()
    expect(screen.getByText('every 60d · 14d over')).toBeTruthy()
    const slippingSection = screen.getByRole('region', { name: 'slipping' })
    expect(within(slippingSection).getAllByRole('button')).toHaveLength(3)
    expect(within(slippingSection).queryByText('dentist checkup')).toBeNull()
  })

  it('labels Variant rows with the parent Tracker name and the Variant name', () => {
    const volvo = makeVariant({ name: 'volvo', latestEntry: makeEntry({ occurredAt: isoDaysAgo(34) }) })
    const tyres = makeTracker({ name: 'tyre pressure', thresholdDays: 30, variants: [volvo] })

    renderHome({ categories: [], trackers: [tyres] })

    const card = screen.getByRole('button')
    expect(card.textContent).toContain('tyre pressure')
    expect(card.textContent).toContain('volvo')
  })

  it('shows "nothing slipping" when nothing is due-soon or overdue', () => {
    const fresh = makeTracker({
      name: 'water plants',
      thresholdDays: 30,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(1) }),
    })

    renderHome({ categories: [], trackers: [fresh] })

    expect(screen.getByText('nothing slipping')).toBeTruthy()
  })

  it('renders quick-log tiles for rows not already shown in the slipping section', () => {
    const overdue = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74) }),
    })
    const recentlyLogged = makeTracker({
      name: 'clean litter box',
      thresholdDays: 30,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(1) }),
    })

    renderHome({ categories: [], trackers: [overdue, recentlyLogged] })

    expect(screen.getByText('quick log')).toBeTruthy()
    expect(screen.getByText('clean litter box')).toBeTruthy()
    // hvac is already a slipping card — it must not also appear as a tile.
    expect(screen.getAllByText('change hvac filter')).toHaveLength(1)
  })

  it('the footer shows the total row count and links to the plain list route, never search-open', () => {
    const a = makeTracker({ name: 'a', thresholdDays: 7, latestEntry: makeEntry({ occurredAt: isoDaysAgo(1) }) })
    const b = makeTracker({ name: 'b', thresholdDays: 7, latestEntry: makeEntry({ occurredAt: isoDaysAgo(1) }) })

    renderHome({ categories: [], trackers: [a, b] })

    const link = screen.getByRole('link', { name: /all items/ })
    expect(link.textContent).toContain('2')
    expect(link.getAttribute('href')).toBe('/list')
  })

  it('never renders a search input itself — search lives on the list tab only', () => {
    renderHome({ categories: [], trackers: [] })
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

/**
 * .scratch/audit-fixes/spec.md decision 5 — loading/failed/empty must not be confused with
 * each other on a cold start (no persisted cache): "nothing slipping" is an
 * answer about Trackers that arrived, not a placeholder for Trackers that
 * haven't. Unlike `renderHome` above, these render without seeding the
 * query cache at all, so `useBootstrapQuery` runs its real query function
 * against a stubbed `fetch`.
 */
describe('HomeRoute loading, failed, and empty states (decision 5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderUnseeded() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HomeRoute />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('shows "loading…", not the empty copy, while bootstrap has never resolved', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderUnseeded()

    expect(screen.getByText('loading…')).toBeTruthy()
    expect(screen.queryByText('nothing slipping')).toBeNull()
  })

  it('shows the failed-state copy when bootstrap has nothing cached and the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderUnseeded()

    expect(await screen.findByText("couldn't load trackers — try again")).toBeTruthy()
    expect(screen.queryByText('nothing slipping')).toBeNull()
  })

  it('keeps showing cached Trackers when a background refetch fails', async () => {
    const hvac = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74) }),
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(bootstrapQueryKey, { categories: [], trackers: [hvac] })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HomeRoute />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(queryClient.getQueryState(bootstrapQueryKey)?.status).toBe('error'))
    expect(screen.getByText('change hvac filter')).toBeTruthy()
    expect(screen.queryByText("couldn't load trackers — try again")).toBeNull()
  })
})

describe('HomeRoute tap-to-log (build ticket 12)', () => {
  const NOW = new Date(2026, 7, 15, 12, 0, 0)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    // unmount before resetting the store — otherwise a still-mounted
    // instance from this test re-renders outside any act() wrapper.
    cleanup()
    logWindowStore.closeSilently()
    vi.stubGlobal('fetch', undefined)
    vi.useRealTimers()
    session.reset()
  })

  function stubPostEntry() {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'server-id',
          trackerId: 't',
          variantId: null,
          occurredAt: NOW.toISOString(),
          durationMinutes: null,
          note: null,
          createdAt: NOW.toISOString(),
        }),
      }),
    )
  }

  it('tapping a slipping card settles it to fresh in place, with "now" and the undo toast', async () => {
    const hvac = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74, NOW) }),
    })
    stubPostEntry()
    renderHome({ categories: [], trackers: [hvac] })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /change hvac filter/ }))
      await vi.advanceTimersByTimeAsync(0)
    })

    // frozen in its slipping slot, not vanished, showing live fresh data.
    const slippingSection = screen.getByRole('region', { name: 'slipping' })
    const card = within(slippingSection).getByRole('button')
    expect(card.className).toContain('slipping-card--fresh')
    expect(card.textContent).toContain('now')

    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('logged ✓')
    expect(screen.getByRole('button', { name: 'undo' })).toBeTruthy()
  })

  it('undo restores the exact previous state and closes the toast', async () => {
    const hvac = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74, NOW) }),
    })
    stubPostEntry()
    renderHome({ categories: [], trackers: [hvac] })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /change hvac filter/ }))
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'undo' }))
      await Promise.resolve()
    })

    // the toast/sheet lingers for its exit fade before unmounting
    // (src/client/shell/useExitTransition.ts) — play it out.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EXIT_DURATION_MS)
    })

    const slippingSection = screen.getByRole('region', { name: 'slipping' })
    expect(within(slippingSection).getByText('74d')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('on toast expiry, the digest re-sorts and the row leaves the slipping section', async () => {
    const hvac = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74, NOW) }),
    })
    stubPostEntry()
    renderHome({ categories: [], trackers: [hvac] })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /change hvac filter/ }))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole('region', { name: 'slipping' }).textContent).toContain('change hvac filter')

    await act(async () => {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    // the toast/sheet lingers for its exit fade before unmounting
    // (src/client/shell/useExitTransition.ts) — play it out.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EXIT_DURATION_MS)
    })

    // now fresh, no longer overdue/due-soon — the slipping section reflects the live (unfrozen) computation again.
    expect(screen.getByText('nothing slipping')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('HomeRoute long-press log sheet (build ticket 13)', () => {
  const NOW = new Date(2026, 7, 15, 12, 0, 0)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    cleanup()
    logSheetStore.close()
    logWindowStore.closeSilently()
    vi.stubGlobal('fetch', undefined)
    vi.useRealTimers()
    session.reset()
  })

  it('holding a slipping card opens the log sheet, and submitting it follows the same settle/toast/undo choreography as a tap', async () => {
    const hvac = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74, NOW) }),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'server-id',
          trackerId: hvac.id,
          variantId: null,
          occurredAt: NOW.toISOString(),
          durationMinutes: null,
          note: null,
          createdAt: NOW.toISOString(),
        }),
      }),
    )
    renderHome({ categories: [], trackers: [hvac] })

    const card = screen.getByRole('button', { name: /change hvac filter/ })
    firePointerEvent(card, 'pointerdown', 10, 10)
    act(() => {
      vi.advanceTimersByTime(450)
    })
    firePointerEvent(card, 'pointerup', 10, 10)
    fireEvent.click(card)

    expect(screen.getByRole('dialog', { name: 'log entry' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'log' }))
      await vi.advanceTimersByTimeAsync(0)
    })

    // the toast/sheet lingers for its exit fade before unmounting
    // (src/client/shell/useExitTransition.ts) — play it out.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EXIT_DURATION_MS)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    const slippingSection = screen.getByRole('region', { name: 'slipping' })
    const settledCard = within(slippingSection).getByRole('button')
    expect(settledCard.className).toContain('slipping-card--fresh')
    expect(settledCard.textContent).toContain('now')
    expect(screen.getByRole('status').textContent).toContain('logged ✓')
  })
})
