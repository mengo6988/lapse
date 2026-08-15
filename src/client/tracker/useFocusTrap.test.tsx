import { fireEvent, render, screen } from '@testing-library/react'
import { useState, type MouseEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function Harness({ onEscapeSpy }: { onEscapeSpy: () => void }) {
  const [active, setActive] = useState(false)
  const [restoreTo, setRestoreTo] = useState<HTMLElement | null>(null)
  const ref = useFocusTrap<HTMLDivElement>(
    active,
    () => {
      onEscapeSpy()
      setActive(false)
    },
    restoreTo,
  )

  function open(event: MouseEvent<HTMLButtonElement>) {
    setRestoreTo(event.currentTarget)
    setActive(true)
  }

  return (
    <div>
      <button onClick={open}>open</button>
      {active && (
        <div ref={ref}>
          <button>first</button>
          <button>second</button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element inside the container on activation', () => {
    render(<Harness onEscapeSpy={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'open' }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))
  })

  it('wraps Tab from the last element back to the first', () => {
    render(<Harness onEscapeSpy={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    screen.getByRole('button', { name: 'second' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))
  })

  it('wraps Shift+Tab from the first element back to the last', () => {
    render(<Harness onEscapeSpy={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    screen.getByRole('button', { name: 'first' }).focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'second' }))
  })

  it('calls onEscape on the Escape key', () => {
    const onEscapeSpy = vi.fn()
    render(<Harness onEscapeSpy={onEscapeSpy} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onEscapeSpy).toHaveBeenCalled()
  })

  it('restores focus to the opener (captured at open time) when it deactivates', () => {
    render(<Harness onEscapeSpy={() => {}} />)
    const openButton = screen.getByRole('button', { name: 'open' })

    fireEvent.click(openButton)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.activeElement).toBe(openButton)
  })

  it('does not steal focus from an element already focused inside the container (e.g. an autoFocus field)', () => {
    function AutoFocusHarness() {
      const [active, setActive] = useState(false)
      const ref = useFocusTrap<HTMLDivElement>(active, () => {}, null)
      return (
        <div>
          <button onClick={() => setActive(true)}>open</button>
          {active && (
            <div ref={ref}>
              <button>first</button>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input aria-label="autofocused" autoFocus />
            </div>
          )}
        </div>
      )
    }
    render(<AutoFocusHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'open' }))

    expect(document.activeElement).toBe(screen.getByLabelText('autofocused'))
  })
})
