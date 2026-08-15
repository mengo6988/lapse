import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload, Category, Entry, Tracker } from '../api'
import { session } from '../auth/session'
import { logSheetStore } from '../log/logSheetStore'
import { logWindowStore } from '../log/logWindowStore'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { ListRoute } from './ListRoute'

// jsdom has no PointerEvent constructor — see
// src/client/detail/SwipeRevealRow.test.tsx's firePointerEvent for why a
// MouseEvent dispatched under the pointer* type name is a faithful stand-in.
function firePointerEvent(target: Element, type: string, clientX: number, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

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

/**
 * the row's styled surface. Since build ticket 15 the `<li>` is rendered by
 * SwipeRevealRow and only carries the swipe scaffolding; the row's own
 * `list-row list-row--{urgency}` classes live on the sliding content inside
 * it, which is what these assertions care about.
 */
function rowContaining(text: string): HTMLElement {
  const item = screen.getAllByRole('listitem').find((li) => li.textContent?.includes(text))
  if (!item) throw new Error(`no row found containing "${text}"`)
  const surface = item.querySelector('.swipe-row__content')
  if (!surface) throw new Error(`row containing "${text}" has no content surface`)
  return surface as HTMLElement
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

describe('ListRoute tap-to-log (build ticket 12)', () => {
  beforeEach(() => {
    // the file-level beforeEach above only fakes Date (userEvent's internal
    // delays elsewhere in this file need real timers) — reinstall fully
    // faked timers for this block instead of stacking onto that config,
    // since every interaction here uses fireEvent, not userEvent.
    vi.useRealTimers()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    // unmount before resetting the store — otherwise a still-mounted
    // instance from this test re-renders outside any act() wrapper.
    cleanup()
    logWindowStore.closeSilently()
    vi.stubGlobal('fetch', undefined)
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

  it('tapping a row settles it to fresh in place, with "now" and the undo toast', async () => {
    stubPostEntry()
    renderList()

    const row = rowContaining('change hvac filter')
    await act(async () => {
      fireEvent.click(row.querySelector('button')!)
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(row.querySelector('.log-settle')).toBeTruthy()
    expect(row.textContent).toContain('now')
    expect(row.className).toContain('list-row--fresh')

    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('logged ✓')
  })

  it('undo restores the exact previous state and closes the toast', async () => {
    stubPostEntry()
    renderList()

    const row = rowContaining('change hvac filter')
    await act(async () => {
      fireEvent.click(row.querySelector('button')!)
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'undo' }))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(row.textContent).toContain('74d')
    expect(row.className).toContain('list-row--overdue')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('row order is frozen for the undo window — the logged row does not jump position', async () => {
    stubPostEntry()
    renderList()

    const orderBefore = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    const hvacIndex = orderBefore.findIndex((t) => t.includes('change hvac filter'))

    const row = rowContaining('change hvac filter')
    await act(async () => {
      fireEvent.click(row.querySelector('button')!)
      await vi.advanceTimersByTimeAsync(0)
    })

    const orderAfter = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(orderAfter.findIndex((t) => t.includes('change hvac filter'))).toBe(hvacIndex)
  })

  it('on toast expiry, the list re-sorts and the row moves to its true (now fresh) position', async () => {
    stubPostEntry()
    renderList()

    const row = rowContaining('change hvac filter')
    await act(async () => {
      fireEvent.click(row.querySelector('button')!)
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(screen.queryByRole('status')).toBeNull()
    // now fresh with the lowest ratio among thresholded/logged rows — sorts to the bottom of that bucket.
    const order = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    const hvacIndex = order.findIndex((t) => t.includes('change hvac filter'))
    const litterIndex = order.findIndex((t) => t.includes('clean litter box'))
    expect(hvacIndex).toBeGreaterThan(litterIndex)
  })
})

describe('ListRoute long-press log sheet (build ticket 13)', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    cleanup()
    logSheetStore.close()
    logWindowStore.closeSilently()
    vi.stubGlobal('fetch', undefined)
    session.reset()
  })

  it('holding a row opens the log sheet, and submitting it follows the same settle/toast/undo choreography as a tap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'server-id',
          trackerId: 'hvac',
          variantId: null,
          occurredAt: NOW.toISOString(),
          durationMinutes: null,
          note: null,
          createdAt: NOW.toISOString(),
        }),
      }),
    )
    renderList()

    const row = rowContaining('change hvac filter')
    const button = row.querySelector('button')!
    firePointerEvent(button, 'pointerdown', 10, 10)
    act(() => {
      vi.advanceTimersByTime(450)
    })
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(screen.getByRole('dialog', { name: 'log entry' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'log' }))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(row.textContent).toContain('now')
    expect(row.className).toContain('list-row--fresh')
    expect(screen.getByRole('status').textContent).toContain('logged ✓')
  })

  it('dragging (swipe-reveal) a row never opens the log sheet, even past 450ms of held contact', () => {
    renderList()

    const row = rowContaining('change hvac filter')
    const button = row.querySelector('button')!
    // a genuine swipe-to-reveal drag, fired on the button itself (as a real
    // touch would start there): horizontal movement well past both
    // SwipeRevealRow's own direction lock and useLongPress's slop threshold.
    // The events bubble from the button up to SwipeRevealRow's own
    // pointerdown/move/up handlers on the wrapping content div, exactly as
    // they would in the browser.
    firePointerEvent(button, 'pointerdown', 200, 50)
    firePointerEvent(button, 'pointermove', 100, 50)
    act(() => {
      vi.advanceTimersByTime(450)
    })
    firePointerEvent(button, 'pointerup', 100, 50)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })
})
