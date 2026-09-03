import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('EXIT_DURATION_MS vs --duration-fade', () => {
  // no runtime coupling (.scratch/audit-fixes/spec.md decision 8) — the hook keeps its own
  // constant, this test just fails the moment it and the CSS token disagree.
  it('matches the fade token every *-out keyframe runs at (src/client/styles/tokens.css)', () => {
    const tokensPath = join(import.meta.dirname, '../styles/tokens.css')
    const tokensCss = readFileSync(tokensPath, 'utf8')
    const match = tokensCss.match(/--duration-fade:\s*(\d+)ms/)

    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(EXIT_DURATION_MS)
  })
})
