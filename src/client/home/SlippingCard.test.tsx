import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logSheetStore } from '../log/logSheetStore'
import { SlippingCard } from './SlippingCard'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

// jsdom has no PointerEvent constructor — see
// src/client/detail/SwipeRevealRow.test.tsx's firePointerEvent for why a
// MouseEvent dispatched under the pointer* type name is a faithful stand-in.
function firePointerEvent(target: Element, type: string, clientX: number, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

describe('SlippingCard', () => {
  it('renders name, subline and big count for an overdue row', () => {
    const row: HomeRow = {
      id: 'hvac',
      trackerId: 'hvac',
      variantId: null,
      name: 'change hvac filter',
      variantLabel: null,
      thresholdDays: 60,
      lastEntryAt: daysAgo(74),
    }

    render(<SlippingCard row={row} now={NOW} />)

    expect(screen.getByText('change hvac filter')).toBeTruthy()
    expect(screen.getByText('every 60d · 14d over')).toBeTruthy()
    expect(screen.getByText('74d')).toBeTruthy()
  })

  it('carries the overdue accent class and a due-soon subline for a due-soon row', () => {
    const row: HomeRow = {
      id: 'crv',
      trackerId: 'crv',
      variantId: 'crv',
      name: 'tyre pressure',
      variantLabel: 'crv',
      thresholdDays: 7,
      lastEntryAt: daysAgo(6),
    }

    render(<SlippingCard row={row} now={NOW} />)

    expect(screen.getByText('every 7d · due tomorrow')).toBeTruthy()
    expect(screen.getByRole('button').className).toContain('slipping-card--due-soon')
  })

  it('labels a Variant row with the parent Tracker name and the Variant name', () => {
    const row: HomeRow = {
      id: 'volvo',
      trackerId: 'tyre',
      variantId: 'volvo',
      name: 'tyre pressure',
      variantLabel: 'volvo',
      thresholdDays: 30,
      lastEntryAt: daysAgo(34),
    }

    render(<SlippingCard row={row} now={NOW} />)

    const button = screen.getByRole('button')
    expect(button.textContent).toContain('tyre pressure')
    expect(button.textContent).toContain('volvo')
  })

  it('is a real button, focusable and 44px+ tall, per the accessibility constraints', () => {
    const row: HomeRow = {
      id: 'hvac',
      trackerId: 'hvac',
      variantId: null,
      name: 'change hvac filter',
      variantLabel: null,
      thresholdDays: 60,
      lastEntryAt: daysAgo(74),
    }

    render(<SlippingCard row={row} now={NOW} />)

    const button = screen.getByRole('button')
    expect(button.getAttribute('type')).toBe('button')
  })

  it('calls onTap with the row when clicked (build ticket 12)', () => {
    const row: HomeRow = {
      id: 'hvac',
      trackerId: 'hvac',
      variantId: null,
      name: 'change hvac filter',
      variantLabel: null,
      thresholdDays: 60,
      lastEntryAt: daysAgo(74),
    }
    const onTap = vi.fn()
    render(<SlippingCard row={row} now={NOW} onTap={onTap} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onTap).toHaveBeenCalledWith(row)
  })

  it('a justLogged row shows "now" and the fresh accent, even though it is still pinned in the overdue slot', () => {
    const row: HomeRow = {
      id: 'hvac',
      trackerId: 'hvac',
      variantId: null,
      name: 'change hvac filter',
      variantLabel: null,
      thresholdDays: 60,
      lastEntryAt: NOW.toISOString(), // frozen slot renders the row's *live* (post-tap) data
    }

    render(<SlippingCard row={row} now={NOW} justLogged />)

    const button = screen.getByRole('button')
    expect(button.className).toContain('slipping-card--fresh')
    expect(button.className).toContain('log-settle')
    expect(screen.getByText('now')).toBeTruthy()
  })
})

// build ticket 13: same long-press-opens-the-log-sheet rule as the list row,
// but simpler here — no swipe wrapper, just the home digest's own scroll to
// disambiguate against (docs/design.md's cancel-on-move rule still applies).
describe('SlippingCard long-press (build ticket 13)', () => {
  const row: HomeRow = {
    id: 'hvac',
    trackerId: 'hvac',
    variantId: null,
    name: 'change hvac filter',
    variantLabel: null,
    thresholdDays: 60,
    lastEntryAt: daysAgo(74),
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logSheetStore.close()
    vi.useRealTimers()
  })

  it('holding the card for 450ms opens the log sheet, without also logging a tap', () => {
    const onTap = vi.fn()
    render(<SlippingCard row={row} now={NOW} onTap={onTap} />)

    const button = screen.getByRole('button')
    firePointerEvent(button, 'pointerdown', 10, 10)
    vi.advanceTimersByTime(450)
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(logSheetStore.read()).toMatchObject({
      mode: 'open',
      target: { trackerId: row.trackerId, variantId: row.variantId },
    })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('a press shorter than 450ms still logs immediately as a tap', () => {
    const onTap = vi.fn()
    render(<SlippingCard row={row} now={NOW} onTap={onTap} />)

    const button = screen.getByRole('button')
    firePointerEvent(button, 'pointerdown', 10, 10)
    vi.advanceTimersByTime(200)
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(onTap).toHaveBeenCalledWith(row)
    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('scrolling the digest (pointer move beyond the slop) cancels the pending long-press', () => {
    render(<SlippingCard row={row} now={NOW} />)

    const button = screen.getByRole('button')
    firePointerEvent(button, 'pointerdown', 10, 10)
    firePointerEvent(button, 'pointermove', 10, 40)
    vi.advanceTimersByTime(450)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })
})
