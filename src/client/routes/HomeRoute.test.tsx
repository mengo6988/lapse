import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from '../home/fixtures'
import { HomeRoute } from './HomeRoute'

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
