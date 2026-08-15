import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logSheetStore } from '../log/logSheetStore'
import { ListRowItem } from './ListRowItem'
import type { ListRow } from './buildListRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')

// jsdom has no PointerEvent constructor, and @testing-library/dom's
// fireEvent only assigns properties that already exist on the fallback
// Event it builds — clientX/clientY are silently dropped. A MouseEvent
// carries them natively and React reads pointer-prop values the same way
// regardless of the event's concrete constructor, so dispatching one under
// the pointer* type name is a faithful stand-in (same pattern as
// src/client/detail/SwipeRevealRow.test.tsx's firePointerEvent).
function firePointerEvent(target: Element, type: string, clientX: number, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

function row(overrides: Partial<ListRow> = {}): ListRow {
  return {
    key: 'k',
    trackerId: 't',
    variantId: null,
    name: 'vacuum house',
    variantName: null,
    categoryId: null,
    thresholdDays: 7,
    lastEntryAt: null,
    urgency: 'never',
    ...overrides,
  }
}

/** the row's own tap-to-log button, as distinct from the swipe-revealed "details" one. */
function tapButton(): HTMLElement {
  return screen.getByRole('button', { name: /vacuum house/ })
}

describe('ListRowItem', () => {
  it('renders inside a real, focusable button so the whole row is one 44px+ tap target', () => {
    render(<ListRowItem row={row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })} now={NOW} />)

    const listItem = screen.getByRole('listitem')
    const button = tapButton()
    expect(button.getAttribute('type')).toBe('button')
    expect(listItem.contains(button)).toBe(true)
    expect(button.textContent).toContain('vacuum house')
  })

  it('calls onTap with the row when clicked (build ticket 12)', () => {
    const onTap = vi.fn()
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} onTap={onTap} />)

    fireEvent.click(tapButton())

    expect(onTap).toHaveBeenCalledWith(theRow)
  })

  it('preserves the existing urgency classes and bar on the row surface, restructuring does not change them', () => {
    render(<ListRowItem row={row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })} now={NOW} />)

    // the classes moved from the <li> onto the sliding surface inside it when
    // the swipe wrapper took over rendering the <li> (build ticket 15).
    const surface = document.querySelector('.swipe-row__content') as HTMLElement
    expect(screen.getByRole('listitem').contains(surface)).toBe(true)
    expect(surface.className).toContain('list-row--overdue')
    expect(surface.querySelector('.list-row__bar--overdue')).toBeTruthy()
  })

  it('a justLogged row shows "now" and the settle animation class', () => {
    render(
      <ListRowItem
        row={row({ urgency: 'fresh', lastEntryAt: NOW.toISOString() })}
        now={NOW}
        justLogged
      />,
    )

    expect(tapButton().className).toContain('log-settle')
    expect(screen.getByText('now')).toBeTruthy()
  })

  // docs/design.md § List: swipe left reveals a single "details" action, and
  // that is the only way into the detail screen — tap and long-press are both
  // spent on logging.
  it('offers a details action that opens the row detail (build ticket 15)', () => {
    const onOpenDetail = vi.fn()
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} onOpenDetail={onOpenDetail} />)

    fireEvent.click(screen.getByRole('button', { name: 'details' }))

    expect(onOpenDetail).toHaveBeenCalledWith(theRow)
  })

  it('without justLogged, shows the ordinary day-bucketed count', () => {
    render(<ListRowItem row={row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })} now={NOW} />)

    expect(screen.getByText('14d')).toBeTruthy()
    expect(tapButton().className).not.toContain('log-settle')
  })
})

// build ticket 13: holding a row for 450ms opens the log sheet for that row
// instead of logging a tap. SwipeRevealRow (ticket 15) already owns
// pointerdown/move/up on the sliding content div, so these events reach both
// it and the tap-to-log button's own long-press timer.
describe('ListRowItem long-press (build ticket 13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logSheetStore.close()
    vi.useRealTimers()
  })

  it('holding the row for 450ms opens the log sheet for that row, without also logging a tap', () => {
    const onTap = vi.fn()
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} onTap={onTap} />)

    const button = tapButton()
    firePointerEvent(button, 'pointerdown', 10, 10)
    vi.advanceTimersByTime(450)
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(logSheetStore.read()).toMatchObject({
      mode: 'open',
      target: { trackerId: theRow.trackerId, variantId: theRow.variantId },
    })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('a press shorter than 450ms still logs immediately as a tap', () => {
    const onTap = vi.fn()
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} onTap={onTap} />)

    const button = tapButton()
    firePointerEvent(button, 'pointerdown', 10, 10)
    vi.advanceTimersByTime(200)
    firePointerEvent(button, 'pointerup', 10, 10)
    fireEvent.click(button)

    expect(onTap).toHaveBeenCalledWith(theRow)
    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('dragging the row (pointer move beyond the slop) cancels the pending long-press', () => {
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} />)

    const button = tapButton()
    firePointerEvent(button, 'pointerdown', 10, 10)
    firePointerEvent(button, 'pointermove', 40, 10)
    vi.advanceTimersByTime(450)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('pointercancel cancels the pending long-press', () => {
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} />)

    const button = tapButton()
    firePointerEvent(button, 'pointerdown', 10, 10)
    firePointerEvent(button, 'pointercancel', 10, 10)
    vi.advanceTimersByTime(450)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('the pointer leaving the row cancels the pending long-press', () => {
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} />)

    const button = tapButton()
    firePointerEvent(button, 'pointerdown', 10, 10)
    // React synthesizes onPointerLeave from the (bubbling) native
    // "pointerout" event, not a raw "pointerleave" — real pointerleave
    // doesn't bubble, so React listens for pointerout at the root and
    // derives enter/leave from relatedTarget, the same way it handles
    // mouseenter/mouseleave via mouseover/mouseout.
    firePointerEvent(button, 'pointerout', 10, 10)
    vi.advanceTimersByTime(450)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })
})
