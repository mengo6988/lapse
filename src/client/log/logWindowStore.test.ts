import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logWindowStore, useLogWindowState, useResortToken } from './logWindowStore'
import type { FreezeSnapshot } from './computeFreezeSnapshot'

const freeze: FreezeSnapshot = { slippingIds: ['a'], quickLogIds: [], listOrder: ['a'] }

describe('logWindowStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logWindowStore.closeSilently()
    vi.useRealTimers()
  })

  it('starts closed', () => {
    expect(logWindowStore.read()).toEqual({ kind: 'closed' })
  })

  it('open() moves to the open state with the given freeze snapshot and undo handler', () => {
    const onUndo = vi.fn()
    logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo })

    expect(logWindowStore.read()).toEqual({
      kind: 'open',
      entryId: 'e1',
      rowId: 'a',
      freeze,
      toastMessage: 'logged ✓',
      onUndo,
    })
  })

  it('auto-expires 5s after open(), bumping the resort token and closing without invoking onUndo', () => {
    const onUndo = vi.fn()
    const tokenBefore = logWindowStore.readResortToken()
    logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo })

    act(() => vi.advanceTimersByTime(5000))

    expect(logWindowStore.read()).toEqual({ kind: 'closed' })
    expect(logWindowStore.readResortToken()).toBe(tokenBefore + 1)
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('closeSilently() closes without bumping the resort token and cancels the pending expiry', () => {
    const tokenBefore = logWindowStore.readResortToken()
    logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() })

    logWindowStore.closeSilently()
    act(() => vi.advanceTimersByTime(5000))

    expect(logWindowStore.read()).toEqual({ kind: 'closed' })
    expect(logWindowStore.readResortToken()).toBe(tokenBefore)
  })

  it('a second open() before expiry replaces the first window and restarts its own 5s timer', () => {
    logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() })
    act(() => vi.advanceTimersByTime(4000))

    const secondUndo = vi.fn()
    logWindowStore.open({ entryId: 'e2', rowId: 'b', freeze, toastMessage: 'logged ✓', onUndo: secondUndo })

    // the first window's original 5s mark passes; only the second's own window matters now.
    act(() => vi.advanceTimersByTime(1000))
    expect(logWindowStore.read()).toMatchObject({ kind: 'open', entryId: 'e2' })

    act(() => vi.advanceTimersByTime(4000))
    expect(logWindowStore.read()).toEqual({ kind: 'closed' })
  })

  it('showMessage() shows a message-only toast, cancels any pending expiry, and auto-dismisses after its own timer', () => {
    logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() })

    logWindowStore.showMessage("couldn't log — try again")
    expect(logWindowStore.read()).toEqual({ kind: 'message', toastMessage: "couldn't log — try again" })

    // the undo window's expiry never fires — showMessage cancelled it.
    const tokenBefore = logWindowStore.readResortToken()
    act(() => vi.advanceTimersByTime(5000))
    expect(logWindowStore.readResortToken()).toBe(tokenBefore)
    expect(logWindowStore.read()).toEqual({ kind: 'closed' })
  })

  it('dismissMessage() closes a message toast immediately', () => {
    logWindowStore.showMessage('couldn\'t undo — offline')
    logWindowStore.dismissMessage()
    expect(logWindowStore.read()).toEqual({ kind: 'closed' })
  })
})

describe('useLogWindowState / useResortToken', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    logWindowStore.closeSilently()
    vi.useRealTimers()
  })

  it('re-renders subscribers on every transition', () => {
    const { result } = renderHook(() => useLogWindowState())
    expect(result.current).toEqual({ kind: 'closed' })

    act(() => logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() }))
    expect(result.current.kind).toBe('open')

    act(() => logWindowStore.closeSilently())
    expect(result.current).toEqual({ kind: 'closed' })
  })

  it('useResortToken only changes on natural expiry, not on undo', () => {
    const { result } = renderHook(() => useResortToken())
    const initial = result.current

    act(() => logWindowStore.open({ entryId: 'e1', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() }))
    act(() => logWindowStore.closeSilently())
    expect(result.current).toBe(initial)

    act(() => logWindowStore.open({ entryId: 'e2', rowId: 'a', freeze, toastMessage: 'logged ✓', onUndo: vi.fn() }))
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(initial + 1)
  })
})
