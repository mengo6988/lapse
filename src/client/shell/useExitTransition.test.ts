import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXIT_DURATION_MS, useExitTransition } from './useExitTransition'

describe('useExitTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('passes a live value straight through, not closing', () => {
    const { result } = renderHook(() => useExitTransition('open'))
    expect(result.current).toEqual({ value: 'open', closing: false })
  })

  it('starts null and stays null', () => {
    const { result } = renderHook(() => useExitTransition(null))
    act(() => vi.advanceTimersByTime(EXIT_DURATION_MS))
    expect(result.current).toEqual({ value: null, closing: false })
  })

  it('latches the last value and reports closing when the input flips to null', () => {
    const { result, rerender } = renderHook(({ value }) => useExitTransition(value), {
      initialProps: { value: 'open' as string | null },
    })
    rerender({ value: null })
    expect(result.current).toEqual({ value: 'open', closing: true })
  })

  it('clears the latched value after the exit duration', () => {
    const { result, rerender } = renderHook(({ value }) => useExitTransition(value), {
      initialProps: { value: 'open' as string | null },
    })
    rerender({ value: null })
    act(() => vi.advanceTimersByTime(EXIT_DURATION_MS))
    expect(result.current).toEqual({ value: null, closing: false })
  })

  it('cancels the exit when the value comes back during the window', () => {
    const { result, rerender } = renderHook(({ value }) => useExitTransition(value), {
      initialProps: { value: 'first' as string | null },
    })
    rerender({ value: null })
    rerender({ value: 'second' })
    act(() => vi.advanceTimersByTime(EXIT_DURATION_MS))
    expect(result.current).toEqual({ value: 'second', closing: false })
  })
})
