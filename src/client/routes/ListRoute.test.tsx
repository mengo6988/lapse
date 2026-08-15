import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload, Category, Entry, Tracker } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { ListRoute } from './ListRoute'

// frozen "now" matching the fixture below — local-time constructor (not a
// UTC ISO string) so day-bucketing math is timezone-safe, per the
// convention in src/client/domain/daysAgo.test.ts.
const NOW = new Date(2026, 7, 15, 12, 0, 0)

function daysBeforeNow(days: number): string {
  return new Date(2026, 7, 15 - days, 12, 0, 0).toISOString()
}

function entry(occurredAt: string): Entry {
  return {
    id: `entry-${occurredAt}`,
    trackerId: 't',
    variantId: null,
    occurredAt,
    durationMinutes: null,
    note: null,
    createdAt: occurredAt,
  }
}

function category(id: string): Category {
  return { id, name: id, color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' }
}

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 'tracker',
    name: 'tracker',
    categoryId: null,
    thresholdDays: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

const payload: BootstrapPayload = {
  categories: [category('house'), category('car')],
  trackers: [
    tracker({
      id: 'hvac',
      name: 'change hvac filter',
      categoryId: 'house',
      thresholdDays: 60,
      latestEntry: entry(daysBeforeNow(74)),
    }),
    tracker({
      id: 'tyre',
      name: 'tyre pressure',
      categoryId: 'car',
      thresholdDays: null,
      variants: [
        { id: 'volvo', name: 'volvo', thresholdDays: 30, latestEntry: entry(daysBeforeNow(34)) },
        { id: 'crv', name: 'crv', thresholdDays: 7, latestEntry: entry(daysBeforeNow(6)) },
      ],
    }),
    tracker({
      id: 'descale',
      name: 'descale coffee machine',
      categoryId: 'house',
      thresholdDays: 90,
      latestEntry: null,
    }),
    tracker({
      id: 'litter',
      name: 'clean litter box',
      categoryId: 'house',
      thresholdDays: 1,
      latestEntry: entry(new Date(2026, 7, 15, 3, 0, 0).toISOString()),
    }),
    tracker({
      id: 'haircut',
      name: 'haircut',
      thresholdDays: null,
      latestEntry: entry(daysBeforeNow(18)),
    }),
    tracker({
      id: 'grandma',
      name: 'call grandma',
      thresholdDays: null,
      latestEntry: null,
    }),
    tracker({
      id: 'archived',
      name: 'ancient chore',
      categoryId: 'house',
      thresholdDays: 7,
      archivedAt: '2026-02-01T00:00:00.000Z',
      latestEntry: null,
    }),
  ],
}

function renderList(initialEntries: string[] = ['/list']) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(bootstrapQueryKey, payload)
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ListRoute />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function rowContaining(text: string): HTMLElement {
  const row = screen.getAllByRole('listitem').find((item) => item.textContent?.includes(text))
  if (!row) throw new Error(`no row found containing "${text}"`)
  return row
}

beforeEach(() => {
  // fake only Date, not setTimeout/rAF — userEvent's internal delays need
  // real timers to resolve, or interactions hang indefinitely.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ListRoute', () => {
  it('renders every active row in spec sort order: thresholded-never, thresholded desc ratio, thresholdless-never, thresholdless desc days', () => {
    renderList()
    const rows = screen.getAllByRole('listitem')
    const order = rows.map((row) => row.textContent ?? '')
    const indexOf = (needle: string) => order.findIndex((text) => text.includes(needle))

    expect(indexOf('descale coffee machine')).toBeLessThan(indexOf('change hvac filter'))
    expect(indexOf('change hvac filter')).toBeLessThan(indexOf('volvo'))
    expect(indexOf('volvo')).toBeLessThan(indexOf('crv'))
    expect(indexOf('crv')).toBeLessThan(indexOf('clean litter box'))
    expect(indexOf('clean litter box')).toBeLessThan(indexOf('call grandma'))
    expect(indexOf('call grandma')).toBeLessThan(indexOf('haircut'))
  })

  it('never excludes an archived Tracker', () => {
    renderList()
    expect(screen.queryByText('ancient chore')).toBeNull()
  })

  it('gives a `never` row an em-dash count, a dotted bar, and a de-emphasised italic name', () => {
    renderList()
    const row = rowContaining('descale coffee machine')
    expect(row.textContent).toContain('—')
    expect(row.className).toContain('list-row--never')
    const bar = row.querySelector('.list-row__bar')
    expect(bar?.className).toContain('list-row__bar--never')
  })

  it('gives a `neutral` logged row a plain digit count, no bar, and a de-emphasised (non-italic) name', () => {
    renderList()
    const row = rowContaining('haircut')
    expect(row.textContent).toContain('18d')
    expect(row.className).toContain('list-row--neutral')
    expect(row.querySelector('.list-row__bar')).toBeNull()
  })

  it('gives a `neutral` never-logged row an em-dash and no bar', () => {
    renderList()
    const row = rowContaining('call grandma')
    expect(row.textContent).toContain('—')
    expect(row.querySelector('.list-row__bar')).toBeNull()
  })

  it('gives overdue/due-soon/fresh rows a solid urgency bar, not a dotted one', () => {
    renderList()
    const overdueBar = rowContaining('change hvac filter').querySelector('.list-row__bar')
    expect(overdueBar?.className).toContain('list-row__bar--overdue')
    const dueSoonBar = rowContaining('crv').querySelector('.list-row__bar')
    expect(dueSoonBar?.className).toContain('list-row__bar--due-soon')
    const freshBar = rowContaining('clean litter box').querySelector('.list-row__bar')
    expect(freshBar?.className).toContain('list-row__bar--fresh')
  })

  it('filters by category chip without changing the relative order within the filter', async () => {
    renderList()
    const rowsBefore = screen.getAllByRole('listitem')
    // 6 active trackers (7 minus the archived one); tyre expands to 2 rows.
    expect(rowsBefore).toHaveLength(7)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'car' }))

    const rows = screen.getAllByRole('listitem')
    const order = rows.map((row) => row.textContent ?? '')
    expect(order).toHaveLength(2)
    expect(order.findIndex((t) => t.includes('volvo'))).toBeLessThan(
      order.findIndex((t) => t.includes('crv')),
    )
  })

  it('the "all" chip is selected by default and category chips are visible when search is closed', () => {
    renderList()
    expect(screen.getByRole('button', { name: 'all' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'house' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /search/i })).toBeNull()
  })

  it('arriving with ?search=open opens the search input, focused, in place of the chips', () => {
    renderList(['/list?search=open'])
    const input = screen.getByRole('textbox', { name: /search/i })
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('button', { name: 'all' })).toBeNull()
  })

  it('filters Tracker and Variant names client-side as the user types', async () => {
    renderList(['/list?search=open'])
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /search/i })
    await user.type(input, 'volvo')

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.textContent).toContain('volvo')
  })

  it('shows "no matches" when the search filter empties the list', async () => {
    renderList(['/list?search=open'])
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /search/i })
    await user.type(input, 'xyz-nonexistent')

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText('no matches')).toBeTruthy()
  })

  it('cancel closes search and restores the category chips', async () => {
    renderList(['/list?search=open'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(screen.queryByRole('textbox', { name: /search/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'all' })).toBeTruthy()
  })
})
