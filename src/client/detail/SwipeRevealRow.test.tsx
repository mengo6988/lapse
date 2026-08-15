import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwipeRevealRow } from './SwipeRevealRow'

// jsdom has no PointerEvent constructor, and @testing-library/dom's
// fireEvent only assigns properties that already exist on the fallback
// Event it builds — clientX/clientY are silently dropped. A MouseEvent
// carries them natively and React reads pointer-prop values the same way
// regardless of the event's concrete constructor, so dispatching one under
// the pointer* type name is a faithful stand-in (same pattern as
// src/client/tracker/TrackerSheet.test.tsx's grabber-drag test).
function firePointerEvent(target: Element, type: string, clientX: number, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

function renderRow(onDetails = vi.fn()) {
  const utils = render(
    <ul>
      <SwipeRevealRow className="probe-row" onDetails={onDetails}>
        <span>tyre pressure</span>
      </SwipeRevealRow>
    </ul>,
  )
  return { ...utils, onDetails }
}

function content(): HTMLElement {
  return document.querySelector('.swipe-row__content') as HTMLElement
}

describe('SwipeRevealRow', () => {
  it('renders its children inside the sliding content surface', () => {
    renderRow()
    expect(screen.getByText('tyre pressure')).toBeTruthy()
  })

  it('preserves the caller className alongside the content element', () => {
    renderRow()
    expect(content().className).toContain('probe-row')
  })

  it('the details action is a real, always-present button — reachable before any swipe', () => {
    renderRow()
    const button = screen.getByRole('button', { name: 'details' })
    expect(button.tagName).toBe('BUTTON')
  })

  it('activating the details button with no gesture calls onDetails', async () => {
    const { onDetails } = renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'details' }))
    expect(onDetails).toHaveBeenCalledTimes(1)
  })

  it('focusing the details action reveals the row visually, for a sighted keyboard user', () => {
    renderRow()
    expect(content().style.transform).toBe('translateX(0px)')

    fireEvent.focus(screen.getByRole('button', { name: 'details' }))
    expect(content().style.transform).toBe('translateX(-84px)')

    fireEvent.blur(screen.getByRole('button', { name: 'details' }))
    expect(content().style.transform).toBe('translateX(0px)')
  })

  it('a leftward drag past the halfway point reveals the row; a rightward drag conceals it again', () => {
    renderRow()

    firePointerEvent(content(), 'pointerdown', 200, 50)
    firePointerEvent(content(), 'pointermove', 120, 50)
    firePointerEvent(content(), 'pointerup', 120, 50)
    expect(content().style.transform).toBe('translateX(-84px)')

    firePointerEvent(content(), 'pointerdown', 120, 50)
    firePointerEvent(content(), 'pointermove', 210, 50)
    firePointerEvent(content(), 'pointerup', 210, 50)
    expect(content().style.transform).toBe('translateX(0px)')
  })

  it('clicking the revealed action conceals the row again and still calls onDetails', () => {
    const { onDetails } = renderRow()

    firePointerEvent(content(), 'pointerdown', 200, 50)
    firePointerEvent(content(), 'pointermove', 100, 50)
    firePointerEvent(content(), 'pointerup', 100, 50)
    expect(content().style.transform).toBe('translateX(-84px)')

    fireEvent.click(screen.getByRole('button', { name: 'details' }))
    expect(onDetails).toHaveBeenCalledTimes(1)
    expect(content().style.transform).toBe('translateX(0px)')
  })

  // The row's own children are a tap-to-log button (ticket 12). A swipe must
  // never also log an Entry, and a tap on an already-open row must close it
  // rather than log — otherwise the gesture that browses history silently
  // writes to it.
  it('swallows the click that ends a swipe, so the row content is not also activated', () => {
    const onTap = vi.fn()
    render(
      <ul>
        <SwipeRevealRow onDetails={vi.fn()}>
          <button type="button" onClick={onTap}>
            log
          </button>
        </SwipeRevealRow>
      </ul>,
    )

    firePointerEvent(content(), 'pointerdown', 200, 50)
    firePointerEvent(content(), 'pointermove', 100, 50)
    firePointerEvent(content(), 'pointerup', 100, 50)
    fireEvent.click(screen.getByRole('button', { name: 'log' }))

    expect(onTap).not.toHaveBeenCalled()
  })

  it('a tap on a revealed row conceals it instead of activating the content', () => {
    const onTap = vi.fn()
    render(
      <ul>
        <SwipeRevealRow onDetails={vi.fn()}>
          <button type="button" onClick={onTap}>
            log
          </button>
        </SwipeRevealRow>
      </ul>,
    )

    fireEvent.focus(screen.getByRole('button', { name: 'details' }))
    expect(content().style.transform).toBe('translateX(-84px)')

    fireEvent.click(screen.getByRole('button', { name: 'log' }))
    expect(onTap).not.toHaveBeenCalled()
    expect(content().style.transform).toBe('translateX(0px)')
  })

  it('a plain tap on a row that was never swiped still reaches the content', () => {
    const onTap = vi.fn()
    render(
      <ul>
        <SwipeRevealRow onDetails={vi.fn()}>
          <button type="button" onClick={onTap}>
            log
          </button>
        </SwipeRevealRow>
      </ul>,
    )

    firePointerEvent(content(), 'pointerdown', 200, 50)
    firePointerEvent(content(), 'pointerup', 200, 50)
    fireEvent.click(screen.getByRole('button', { name: 'log' }))

    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('a vertical drag is not treated as a swipe, so the tap still reaches the content', () => {
    const onTap = vi.fn()
    render(
      <ul>
        <SwipeRevealRow onDetails={vi.fn()}>
          <button type="button" onClick={onTap}>
            log
          </button>
        </SwipeRevealRow>
      </ul>,
    )

    firePointerEvent(content(), 'pointerdown', 200, 50)
    firePointerEvent(content(), 'pointermove', 202, 140)
    firePointerEvent(content(), 'pointerup', 202, 140)
    fireEvent.click(screen.getByRole('button', { name: 'log' }))

    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('supports a custom accessible label for the action', () => {
    render(
      <ul>
        <SwipeRevealRow onDetails={vi.fn()} detailsLabel="open">
          <span>row</span>
        </SwipeRevealRow>
      </ul>,
    )
    expect(screen.getByRole('button', { name: 'open' })).toBeTruthy()
  })
})
