/**
 * Swipe-to-reveal gesture state for a list row (docs/design.md § List:
 * "swipe left on a row reveals a single details action"). Pure gesture
 * state — no DOM measurement, no CSS — so it's unit-testable with plain
 * `{clientX, clientY}` points standing in for pointer/touch events.
 * SwipeRevealRow.tsx is the primary consumer; `useSwipeReveal` is exported
 * separately for anything that wants the state machine without its markup.
 *
 * Direction lock: the first `directionLockPx` of movement decides
 * horizontal vs vertical. A vertical drag abandons the gesture entirely (no
 * transform, tracking dropped) so the page keeps scrolling normally — this
 * is also why the gesture never fights iOS's own edge-swipe-back: that's a
 * *rightward* drag starting at the screen's left edge, and this hook only
 * ever reveals on a *leftward* drag, so the two never compete for the same
 * touch.
 */
import { useCallback, useRef, useState } from 'react'

export interface SwipePoint {
  readonly clientX: number
  readonly clientY: number
}

export interface UseSwipeRevealOptions {
  /** px the content must slide to fully reveal the action. Default 84. */
  readonly revealWidthPx?: number
  /** px of movement before horizontal-vs-vertical is decided. Default 8. */
  readonly directionLockPx?: number
}

export interface UseSwipeRevealResult {
  /** true once the action is fully revealed (by drag, or reveal()/focus). */
  readonly revealed: boolean
  /** current horizontal offset in px, always within [-revealWidthPx, 0]. */
  readonly offsetX: number
  reveal(): void
  conceal(): void
  onPointerDown(point: SwipePoint): void
  onPointerMove(point: SwipePoint): void
  /** returns true when the gesture that just ended was a horizontal swipe. */
  onPointerUp(): boolean
  onPointerCancel(): void
}

const DEFAULT_REVEAL_WIDTH_PX = 84
const DEFAULT_DIRECTION_LOCK_PX = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

type Axis = 'horizontal' | 'vertical' | null

interface DragState {
  startX: number
  startY: number
  baseOffset: number
  axis: Axis
}

export function useSwipeReveal(options: UseSwipeRevealOptions = {}): UseSwipeRevealResult {
  const revealWidthPx = options.revealWidthPx ?? DEFAULT_REVEAL_WIDTH_PX
  const directionLockPx = options.directionLockPx ?? DEFAULT_DIRECTION_LOCK_PX

  const [revealed, setRevealed] = useState(false)
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const reveal = useCallback(() => setRevealed(true), [])
  const conceal = useCallback(() => setRevealed(false), [])

  const onPointerDown = useCallback(
    (point: SwipePoint) => {
      dragRef.current = {
        startX: point.clientX,
        startY: point.clientY,
        baseOffset: revealed ? -revealWidthPx : 0,
        axis: null,
      }
    },
    [revealed, revealWidthPx],
  )

  const onPointerMove = useCallback(
    (point: SwipePoint) => {
      const drag = dragRef.current
      if (!drag) return

      const dx = point.clientX - drag.startX
      const dy = point.clientY - drag.startY

      if (drag.axis === null) {
        if (Math.abs(dx) < directionLockPx && Math.abs(dy) < directionLockPx) return
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
        if (drag.axis === 'vertical') {
          // Not our gesture — abandon tracking so the page scrolls normally.
          dragRef.current = null
          return
        }
      }

      setDragOffset(clamp(drag.baseOffset + dx, -revealWidthPx, 0))
    },
    [directionLockPx, revealWidthPx],
  )

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    const swiped = drag?.axis === 'horizontal'
    if (drag && swiped) {
      const finalOffset = dragOffset ?? drag.baseOffset
      setRevealed(finalOffset <= -revealWidthPx / 2)
    }
    setDragOffset(null)
    return swiped
  }, [dragOffset, revealWidthPx])

  const onPointerCancel = useCallback(() => {
    dragRef.current = null
    setDragOffset(null)
  }, [])

  const offsetX = dragOffset ?? (revealed ? -revealWidthPx : 0)

  return { revealed, offsetX, reveal, conceal, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
