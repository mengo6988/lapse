import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload, Tracker } from '../api'
import { activityEntriesQueryKey } from '../activity/useActivityEntries'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { ActivityRoute } from './ActivityRoute'

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 't1',
    name: 'tyre pressure',
    categoryId: null,
    thresholdDays: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderRoute(trackers: Tracker[]) {
  // staleTime: Infinity keeps the pre-seeded bootstrap query from firing a
  // background refetch on mount, matching src/client/archived/ArchivedRoute.test.tsx's
  // precedent — the activity Entry feed itself is a fresh query with no
  // seeded data, so its own first fetch always fires regardless.
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  const payload: BootstrapPayload = { categories: [], trackers }
  queryClient.setQueryData(bootstrapQueryKey, payload)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/activity']}>
        <ActivityRoute />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function mockEntriesFetch(response: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => response })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('ActivityRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes itself as the "activity" region', async () => {
    mockEntriesFetch({ entries: [], nextCursor: null })
    renderRoute([tracker()])

    expect(screen.getByRole('region', { name: 'activity' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('nothing logged yet')).toBeTruthy())
  })

  it('shows the empty state in the canonical copy voice when there are no Entries', async () => {
    mockEntriesFetch({ entries: [], nextCursor: null })
    renderRoute([tracker()])

    await waitFor(() => expect(screen.getByText('nothing logged yet')).toBeTruthy())
  })

  it('lists Entries newest-first, day-bucketed, showing Tracker, Variant, relative time, and meta', async () => {
    const withVariant = tracker({
      id: 't1',
      name: 'tyre pressure',
      variants: [{ id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null }],
    })
    const today = new Date()
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 9, 0, 0)
    mockEntriesFetch({
      entries: [
        {
          id: 'e-today',
          trackerId: 't1',
          variantId: 'v1',
          occurredAt: today.toISOString(),
          durationMinutes: 30,
          note: 'topped up',
          createdAt: today.toISOString(),
        },
        {
          id: 'e-yesterday',
          trackerId: 't1',
          variantId: null,
          occurredAt: yesterday.toISOString(),
          durationMinutes: null,
          note: null,
          createdAt: yesterday.toISOString(),
        },
      ],
      nextCursor: null,
    })
    renderRoute([withVariant])

    await waitFor(() => expect(screen.getByRole('heading', { name: 'today' })).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'yesterday' })).toBeTruthy()

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.textContent).toContain('tyre pressure · volvo')
    expect(buttons[0]?.textContent).toContain('30m')
    expect(buttons[0]?.textContent).toContain('topped up')
    expect(buttons[1]?.textContent).toContain('tyre pressure')
    expect(buttons[1]?.textContent).not.toContain('·')
  })

  it('tapping an Entry navigates to the Tracker detail screen', async () => {
    mockEntriesFetch({
      entries: [
        {
          id: 'e1',
          trackerId: 't1',
          variantId: null,
          occurredAt: new Date().toISOString(),
          durationMinutes: null,
          note: null,
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    })
    renderRoute([tracker({ id: 't1' })])

    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button')).toBeTruthy())
    await user.click(screen.getByRole('button'))

    expect(screen.getByTestId('location').textContent).toBe('/tracker/t1')
  })

  it('shows an error state when the feed fails to load', async () => {
    mockEntriesFetch({ error: 'boom' }, 500)
    renderRoute([tracker()])

    await waitFor(() => expect(screen.getByText(/couldn.t load activity/)).toBeTruthy())
  })
})

/**
 * .scratch/audit-fixes/spec.md decision 5 — buildActivityRows drops every Entry whose
 * Tracker isn't in the bootstrap payload yet, so an Entries page that
 * resolves before bootstrap does must not read as "nothing logged yet".
 * Unlike `renderRoute` above, this seeds nothing into the query cache:
 * `/api/entries` resolves normally while `/api/bootstrap` hangs forever, so
 * the race the bug depended on is reproduced for real rather than asserted
 * by inspection.
 */
describe('ActivityRoute loading, failed, and empty states (decision 5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not render "nothing logged yet" once Entries have loaded while bootstrap is still pending', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.startsWith('/api/entries')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            entries: [
              {
                id: 'e1',
                trackerId: 't1',
                variantId: null,
                occurredAt: new Date().toISOString(),
                durationMinutes: null,
                note: null,
                createdAt: new Date().toISOString(),
              },
            ],
            nextCursor: null,
          }),
        })
      }
      // /api/bootstrap: never resolves — bootstrap stays pending.
      return new Promise(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/activity']}>
          <ActivityRoute />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(queryClient.getQueryState(activityEntriesQueryKey)?.status).toBe('success'))

    expect(screen.queryByText('nothing logged yet')).toBeNull()
    expect(screen.getByText('loading…')).toBeTruthy()
  })
})
