import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logWindowStore } from './logWindowStore'
import { LogToast } from './LogToast'

const freeze = { slippingIds: [], quickLogIds: [], listOrder: [] }

describe('LogToast', () => {
  afterEach(() => {
    // unmount before resetting the store — otherwise a still-mounted
    // instance from this test re-renders outside any act() wrapper.
    cleanup()
    logWindowStore.closeSilently()
  })

  it('renders nothing while the log window is closed', () => {
    render(<LogToast />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows "logged ✓" with an undo button in a politely-announced status region while open', () => {
    render(<LogToast />)
    act(() =>
      logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() }),
    )

    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toContain('logged ✓')
    expect(screen.getByRole('button', { name: 'undo' })).toBeTruthy()
  })

  it('clicking undo invokes the current onUndo handler', () => {
    const onUndo = vi.fn()
    render(<LogToast />)
    act(() => logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo }))

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'undo' }))
    })

    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('shows a plain message with no undo button for a message-only toast (e.g. a failure)', () => {
    render(<LogToast />)
    act(() => logWindowStore.showMessage("couldn't log — try again"))

    const region = screen.getByRole('status')
    expect(region.textContent).toBe("couldn't log — try again")
    expect(screen.queryByRole('button', { name: 'undo' })).toBeNull()
  })
})
