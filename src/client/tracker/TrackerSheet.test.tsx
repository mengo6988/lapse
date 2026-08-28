import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackerSheet } from './TrackerSheet'

// jsdom has no PointerEvent constructor, and @testing-library/dom's
// fireEvent only assigns properties that already exist on the fallback
// Event it builds — clientY is silently dropped. A MouseEvent carries
// clientY natively and React reads it the same way regardless of the
// event's concrete constructor, so dispatching one under the pointer* type
// name is a faithful enough stand-in for this test (same pattern as
// src/client/detail/SwipeRevealRow.test.tsx). Going through RTL's fireEvent
// (rather than target.dispatchEvent directly) wraps the dispatch in act(),
// which the drag-follow assertions below need — they read a DOM style that
// only updates once the resulting setState has flushed.
function firePointerEvent(target: Element, type: string, clientY: number) {
  fireEvent(target, new MouseEvent(type, { clientY, bubbles: true }))
}

// jsdom has no matchMedia at all (TrackerSheet.tsx guards for that). Stub it
// for the reduced-motion tests only, and always clean up afterward so it
// doesn't leak into the plain jsdom-has-no-matchMedia case other tests rely
// on.
function stubReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia
}

afterEach(() => {
  // @ts-expect-error — deleting a property that TS believes is always present, to restore jsdom's real (absent) matchMedia.
  delete window.matchMedia
})

describe('TrackerSheet', () => {
  it('renders as a labelled modal dialog with the given title', () => {
    render(
      <TrackerSheet title="new tracker" onClose={() => {}} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )

    const dialog = screen.getByRole('dialog', { name: 'new tracker' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('content')).toBeTruthy()
  })

  it('close button calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )

    await user.click(screen.getByRole('button', { name: 'close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('releasing a downward drag past the threshold on the grabber calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )
    const grabber = container.querySelector('.tracker-sheet__grabber')!

    firePointerEvent(grabber, 'pointerdown', 100)
    firePointerEvent(grabber, 'pointermove', 170)
    expect(onClose).not.toHaveBeenCalled() // follows the finger, doesn't dismiss mid-drag

    firePointerEvent(grabber, 'pointerup', 170)
    expect(onClose).toHaveBeenCalled()
  })

  it('releasing a small drag under the threshold does not close, and springs back', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )
    const grabber = container.querySelector('.tracker-sheet__grabber')!
    const dialog = screen.getByRole('dialog')

    firePointerEvent(grabber, 'pointerdown', 100)
    firePointerEvent(grabber, 'pointermove', 120)
    expect(dialog.style.transform).toBe('translateY(20px)')

    firePointerEvent(grabber, 'pointerup', 120)

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.style.transform).toBe('')
  })

  it('a pointercancel mid-drag under the threshold springs back without closing', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )
    const grabber = container.querySelector('.tracker-sheet__grabber')!
    const dialog = screen.getByRole('dialog')

    firePointerEvent(grabber, 'pointerdown', 100)
    firePointerEvent(grabber, 'pointermove', 130)
    expect(dialog.style.transform).toBe('translateY(30px)')

    firePointerEvent(grabber, 'pointercancel', 130)

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.style.transform).toBe('')
  })

  describe('prefers-reduced-motion', () => {
    it('a downward drag past the threshold calls onClose immediately, without following', () => {
      stubReducedMotion(true)
      const onClose = vi.fn()
      const { container } = render(
        <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
          <p>content</p>
        </TrackerSheet>,
      )
      const grabber = container.querySelector('.tracker-sheet__grabber')!
      const dialog = screen.getByRole('dialog')

      firePointerEvent(grabber, 'pointerdown', 100)
      firePointerEvent(grabber, 'pointermove', 170)

      expect(onClose).toHaveBeenCalled()
      expect(dialog.style.transform).toBe('')
    })

    it('a small drag under the threshold does not close on release', () => {
      stubReducedMotion(true)
      const onClose = vi.fn()
      const { container } = render(
        <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
          <p>content</p>
        </TrackerSheet>,
      )
      const grabber = container.querySelector('.tracker-sheet__grabber')!

      firePointerEvent(grabber, 'pointerdown', 100)
      firePointerEvent(grabber, 'pointermove', 120)
      firePointerEvent(grabber, 'pointerup', 120)

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
