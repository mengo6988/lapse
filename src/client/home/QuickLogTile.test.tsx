import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListRow } from '../domain/trackerRows'
import { urgencyState } from '../domain/urgency'
import { logSheetStore } from '../log/logSheetStore'
import { QuickLogTile } from './QuickLogTile'

// jsdom has no PointerEvent constructor — see
// src/client/detail/SwipeRevealRow.test.tsx's firePointerEvent for why a
// MouseEvent dispatched under the pointer* type name is a faithful stand-in.
function firePointerEvent(target: Element, type: string, clientX: number, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const baseRow: ListRow = {
  key: 'litter',
  trackerId: 'litter',
  variantId: null,
  name: 'clean litter box',
  variantName: null,
  categoryId: null,
  thresholdDays: 1,
  lastEntryAt: null,
  urgency: urgencyState(null, 1, NOW),
}

describe('QuickLogTile', () => {
  it('shows "never" when there is no Entry', () => {
    render(<QuickLogTile row={baseRow} now={NOW} />)
    expect(screen.getByText('never')).toBeTruthy()
  })

  it('shows "Xd ago" for a logged row', () => {
    render(<QuickLogTile row={{ ...baseRow, lastEntryAt: daysAgo(2) }} now={NOW} />)
    expect(screen.getByText('2d ago')).toBeTruthy()
  })

  it('labels a Variant row with the parent Tracker name and the Variant name', () => {
    const row: ListRow = { ...baseRow, name: 'tyre pressure', variantName: 'crv', lastEntryAt: daysAgo(6) }
    render(<QuickLogTile row={row} now={NOW} />)

    const button = screen.getByRole('button')
    expect(button.textContent).toContain('tyre pressure')
    expect(button.textContent).toContain('crv')
  })

  it('calls onTap with the row when clicked (build ticket 12)', () => {
    const onTap = vi.fn()
    render(<QuickLogTile row={baseRow} now={NOW} onTap={onTap} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onTap).toHaveBeenCalledWith(baseRow)
  })

  it('a justLogged tile shows "now" and the settle animation class', () => {
    const row: ListRow = { ...baseRow, lastEntryAt: NOW.toISOString() }
    render(<QuickLogTile row={row} now={NOW} justLogged />)

    expect(screen.getByText('now')).toBeTruthy()
    expect(screen.getByRole('button').className).toContain('log-settle')
  })
})

// build ticket 13: same long-press-opens-the-log-sheet rule as the slipping
// card and list row (docs/design.md's cancel-on-move rule against the home
// digest's own scroll still applies).
describe('QuickLogTile long-press (build ticket 13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logSheetStore.close()
    vi.useRealTimers()
  })

  it('holding the tile for 450ms opens the log sheet, without also logging a tap', () => {
    const onTap = vi.fn()
    render(<QuickLogTile row={baseRow} now={NOW} onTap={onTap} />)

    const button = screen.getByRole('button')
    firePointerEvent(button, 'pointerdown', 10, 10)
    vi.advanceTimersByTime(450)
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(logSheetStore.read()).toMatchObject({
      mode: 'open',
      target: { trackerId: baseRow.trackerId, variantId: baseRow.variantId },
    })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('a press shorter than 450ms still logs immediately as a tap', () => {
    const onTap = vi.fn()
    render(<QuickLogTile row={baseRow} now={NOW} onTap={onTap} />)

    const button = screen.getByRole('button')
    firePointerEvent(button, 'pointerdown', 10, 10)
    vi.advanceTimersByTime(200)
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(onTap).toHaveBeenCalledWith(baseRow)
    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('scrolling the digest (pointer move beyond the slop) cancels the pending long-press', () => {
    render(<QuickLogTile row={baseRow} now={NOW} />)

    const button = screen.getByRole('button')
    firePointerEvent(button, 'pointerdown', 10, 10)
    firePointerEvent(button, 'pointermove', 10, 40)
    vi.advanceTimersByTime(450)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })
})
