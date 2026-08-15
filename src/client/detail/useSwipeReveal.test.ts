import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSwipeReveal } from './useSwipeReveal'

const REVEAL_WIDTH = 84

describe('useSwipeReveal', () => {
  it('starts concealed at offset 0', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    expect(result.current.revealed).toBe(false)
    expect(result.current.offsetX).toBe(0)
  })

  it('reveals once a leftward drag passes the halfway point, snapping fully open', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.onPointerDown({ clientX: 200, clientY: 100 }))
    act(() => result.current.onPointerMove({ clientX: 200 - REVEAL_WIDTH * 0.6, clientY: 100 }))
    act(() => result.current.onPointerUp())
    expect(result.current.revealed).toBe(true)
    expect(result.current.offsetX).toBe(-REVEAL_WIDTH)
  })

  it('snaps back closed when the drag does not pass the halfway point', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.onPointerDown({ clientX: 200, clientY: 100 }))
    act(() => result.current.onPointerMove({ clientX: 200 - REVEAL_WIDTH * 0.3, clientY: 100 }))
    act(() => result.current.onPointerUp())
    expect(result.current.revealed).toBe(false)
    expect(result.current.offsetX).toBe(0)
  })

  it('clamps the drag offset to the reveal width even if the finger moves further', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.onPointerDown({ clientX: 200, clientY: 100 }))
    act(() => result.current.onPointerMove({ clientX: 200 - REVEAL_WIDTH * 3, clientY: 100 }))
    expect(result.current.offsetX).toBe(-REVEAL_WIDTH)
  })

  it('abandons the gesture on a predominantly vertical drag, so the page keeps scrolling', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.onPointerDown({ clientX: 200, clientY: 100 }))
    act(() => result.current.onPointerMove({ clientX: 195, clientY: 140 }))
    act(() => result.current.onPointerUp())
    expect(result.current.revealed).toBe(false)
    expect(result.current.offsetX).toBe(0)
  })

  it('a rightward drag from the revealed state can close it again', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.reveal())
    act(() => result.current.onPointerDown({ clientX: 200, clientY: 100 }))
    act(() => result.current.onPointerMove({ clientX: 200 + REVEAL_WIDTH * 0.7, clientY: 100 }))
    act(() => result.current.onPointerUp())
    expect(result.current.revealed).toBe(false)
  })

  it('reveal() and conceal() set state directly, independent of any drag', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.reveal())
    expect(result.current.revealed).toBe(true)
    expect(result.current.offsetX).toBe(-REVEAL_WIDTH)
    act(() => result.current.conceal())
    expect(result.current.revealed).toBe(false)
    expect(result.current.offsetX).toBe(0)
  })

  it('onPointerCancel abandons an in-progress drag without committing a reveal', () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidthPx: REVEAL_WIDTH }))
    act(() => result.current.onPointerDown({ clientX: 200, clientY: 100 }))
    act(() => result.current.onPointerMove({ clientX: 200 - REVEAL_WIDTH, clientY: 100 }))
    act(() => result.current.onPointerCancel())
    expect(result.current.offsetX).toBe(0)
    expect(result.current.revealed).toBe(false)
  })

  it('defaults to an 84px reveal width when none is given', () => {
    const { result } = renderHook(() => useSwipeReveal())
    act(() => result.current.reveal())
    expect(result.current.offsetX).toBe(-84)
  })
})
