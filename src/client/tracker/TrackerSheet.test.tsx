import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TrackerSheet } from './TrackerSheet'

// jsdom has no PointerEvent constructor, and @testing-library/dom's
// fireEvent only assigns properties that already exist on the fallback
// Event it builds — clientY is silently dropped. A MouseEvent carries
// clientY natively and React reads it the same way regardless of the
// event's concrete constructor, so dispatching one under the pointer* type
// name is a faithful enough stand-in for this test.
function firePointerEvent(target: Element, type: string, clientY: number) {
  target.dispatchEvent(new MouseEvent(type, { clientY, bubbles: true }))
}

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

  it('a downward drag past the threshold on the grabber calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )
    const grabber = container.querySelector('.tracker-sheet__grabber')!

    firePointerEvent(grabber, 'pointerdown', 100)
    firePointerEvent(grabber, 'pointermove', 170)

    expect(onClose).toHaveBeenCalled()
  })

  it('a small drag under the threshold does not close', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TrackerSheet title="new tracker" onClose={onClose} containerRef={createRef()}>
        <p>content</p>
      </TrackerSheet>,
    )
    const grabber = container.querySelector('.tracker-sheet__grabber')!

    firePointerEvent(grabber, 'pointerdown', 100)
    firePointerEvent(grabber, 'pointermove', 120)

    expect(onClose).not.toHaveBeenCalled()
  })
})
