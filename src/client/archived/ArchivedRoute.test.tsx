import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload, Tracker } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { ArchivedRoute } from './ArchivedRoute'

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 't1',
    name: 'ancient chore',
    categoryId: null,
    thresholdDays: 7,
    archivedAt: '2026-08-01T00:00:00.000Z',
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
  // background refetch on mount, which would otherwise steal a queued fetch
  // mock response meant for the entry-count/delete calls this file makes
  // (react-query still runs a query's very first fetch regardless of
  // staleTime — only *re*fetches of already-cached data are skipped, so the
  // entry-count query under test still fires as expected).
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  const payload: BootstrapPayload = { categories: [], trackers }
  queryClient.setQueryData(bootstrapQueryKey, payload)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/archived']}>
        <ArchivedRoute />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient }
}

describe('ArchivedRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the empty state when there are no archived Trackers', () => {
    renderRoute([tracker({ archivedAt: null })])

    expect(screen.getByText('nothing archived')).toBeTruthy()
  })

  it('lists an archived Tracker but never an active one', () => {
    renderRoute([
      tracker({ id: 'archived-1', name: 'ancient chore', archivedAt: '2026-08-01T00:00:00.000Z' }),
      tracker({ id: 'active-1', name: 'still going', archivedAt: null }),
    ])

    expect(screen.getByText('ancient chore')).toBeTruthy()
    expect(screen.queryByText('still going')).toBeNull()
  })

  it('sorts most recently archived first', () => {
    renderRoute([
      tracker({ id: 'older', name: 'older archive', archivedAt: '2026-01-01T00:00:00.000Z' }),
      tracker({ id: 'newer', name: 'newer archive', archivedAt: '2026-08-01T00:00:00.000Z' }),
    ])

    const names = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')
    expect(names[0]).toContain('newer archive')
    expect(names[1]).toContain('older archive')
  })

  it('the back button navigates to /settings', async () => {
    const user = userEvent.setup()
    renderRoute([tracker()])

    await user.click(screen.getByRole('button', { name: 'back' }))

    expect(screen.getByTestId('location').textContent).toBe('/settings')
  })

  it('unarchiving removes the row once the cache reflects the change', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...tracker(), archivedAt: null, variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRoute([tracker()])

    await user.click(screen.getByRole('button', { name: 'unarchive' }))

    await waitFor(() => expect(screen.getByText('nothing archived')).toBeTruthy())
  })

  it('opens the hard-delete dialog for the clicked row, and cancelling it changes nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    const user = userEvent.setup()
    renderRoute([tracker({ name: 'ancient chore' })])

    await user.click(screen.getByRole('button', { name: 'delete' }))
    expect(screen.getByRole('dialog', { name: 'delete ancient chore' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'cancel' }))

    // the dialog lingers for its exit fade before unmounting — see
    // src/client/shell/useExitTransition.ts.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('ancient chore')).toBeTruthy()
  })

  it('confirming hard delete removes the Tracker from the list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ entries: [{}, {}], nextCursor: null }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRoute([tracker({ name: 'ancient chore' })])

    await user.click(screen.getByRole('button', { name: 'delete' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'delete forever' }).hasAttribute('disabled')).toBe(false))
    await user.click(screen.getByRole('button', { name: 'delete forever' }))

    await waitFor(() => expect(screen.getByText('nothing archived')).toBeTruthy())
  })
})
