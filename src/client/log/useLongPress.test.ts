import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from './useLongPress'

const DELAY_MS = 450

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires onLongPress once the hold delay elapses', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    expect(onLongPress).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(DELAY_MS))
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire when pointerUp happens before the delay — a shorter press is a tap', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.onPointerUp())
    act(() => vi.advanceTimersByTime(DELAY_MS))

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('cancels the pending press once movement exceeds the slop threshold', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS, moveTolerancePx: 8 }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => result.current.onPointerMove({ clientX: 25, clientY: 10 }))
    act(() => vi.advanceTimersByTime(DELAY_MS))

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('movement within the slop threshold does not cancel the press', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS, moveTolerancePx: 8 }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => result.current.onPointerMove({ clientX: 14, clientY: 10 }))
    act(() => vi.advanceTimersByTime(DELAY_MS))

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('onPointerCancel cancels the pending press', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => result.current.onPointerCancel())
    act(() => vi.advanceTimersByTime(DELAY_MS))

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('onPointerLeave cancels the pending press — the pointer leaving the element counts as abandoning it', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => result.current.onPointerLeave())
    act(() => vi.advanceTimersByTime(DELAY_MS))

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('shouldSuppressClick is true exactly once after a long press fires, then resets to false', () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn(), delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => vi.advanceTimersByTime(DELAY_MS))

    expect(result.current.shouldSuppressClick()).toBe(true)
    expect(result.current.shouldSuppressClick()).toBe(false)
  })

  it('shouldSuppressClick is false for an ordinary short press, so the click reaches the tap handler', () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn(), delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.onPointerUp())

    expect(result.current.shouldSuppressClick()).toBe(false)
  })

  it('a fresh pointerDown always starts a new gesture, even if the previous one never released', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, delayMs: DELAY_MS }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.onPointerDown({ clientX: 50, clientY: 50 }))
    act(() => vi.advanceTimersByTime(200))
    expect(onLongPress).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(250))
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('defaults to a 450ms delay when none is given', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 }))
    act(() => vi.advanceTimersByTime(449))
    expect(onLongPress).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })
})

describe('keyboard long-press', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires after holding Space for the delay — the log sheet has a keyboard route', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress }))

    act(() => result.current.onKeyDown({ key: ' ', repeat: false }))
    expect(onLongPress).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(450))
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('suppresses the click Space fires on key-up, so a hold does not also log a tap', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress }))

    act(() => result.current.onKeyDown({ key: ' ', repeat: false }))
    act(() => void vi.advanceTimersByTime(450))
    act(() => result.current.onKeyUp())

    expect(result.current.shouldSuppressClick()).toBe(true)
  })

  it('releasing Space early is a plain tap', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress }))

    act(() => result.current.onKeyDown({ key: ' ', repeat: false }))
    act(() => void vi.advanceTimersByTime(200))
    act(() => result.current.onKeyUp())
    act(() => void vi.advanceTimersByTime(450))

    expect(onLongPress).not.toHaveBeenCalled()
    expect(result.current.shouldSuppressClick()).toBe(false)
  })

  it('ignores auto-repeat, so a held key restarts nothing', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress }))

    act(() => result.current.onKeyDown({ key: ' ', repeat: false }))
    act(() => void vi.advanceTimersByTime(400))
    act(() => result.current.onKeyDown({ key: ' ', repeat: true }))
    act(() => void vi.advanceTimersByTime(50))

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('ignores Enter — it fires its click on key-down, so a hold would log a tap first', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress }))

    act(() => result.current.onKeyDown({ key: 'Enter', repeat: false }))
    act(() => void vi.advanceTimersByTime(450))

    expect(onLongPress).not.toHaveBeenCalled()
  })
})
