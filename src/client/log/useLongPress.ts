/**
 * Long-press gesture (docs/design.md § Home "Long-press (450ms) → log
 * sheet.", build ticket 13): holding a row/tile/card for 450ms opens the
 * log sheet; a shorter press lets the ordinary click through as a tap; and
 * a pointer move beyond a small slop cancels the pending press — the same
 * rule that keeps a swipe-to-reveal drag (src/client/detail/
 * SwipeRevealRow.tsx, read-only) or the home digest's own scroll from ever
 * accidentally opening the sheet, since either gesture moves well past this
 * threshold long before 450ms elapses.
 *
 * Pure gesture state, no DOM measurement — mirrors src/client/detail/
 * useSwipeReveal.ts's shape (plain {clientX, clientY} points rather than
 * React's PointerEvent) so it's unit-testable without jsdom's incomplete
 * PointerEvent support, and stays framework-agnostic like that hook. Callers
 * (ListRowItem, SlippingCard, QuickLogTile) own the pressed DOM element
 * themselves — this hook only decides *whether* a long-press fired, never
 * what to do about it.
 */
import { useCallback, useEffect, useRef } from 'react'

export interface LongPressPoint {
  readonly clientX: number
  readonly clientY: number
}

export interface UseLongPressOptions {
  readonly onLongPress: () => void
  /** ms of hold before firing. docs/design.md: 450. */
  readonly delayMs?: number
  /** px of pointer movement that cancels the pending press. */
  readonly moveTolerancePx?: number
}

export interface UseLongPressResult {
  onPointerDown(point: LongPressPoint): void
  onPointerMove(point: LongPressPoint): void
  onPointerUp(): void
  onPointerCancel(): void
  onPointerLeave(): void
  /**
   * Call at the top of the element's own onClick. True (and reset back to
   * false) exactly once per fired long-press, so the click that follows a
   * long-press's pointerup doesn't also log a tap — ticket 13's "the
   * subsequent pointerup/click MUST NOT also log a tap."
   */
  shouldSuppressClick(): boolean
}

const DEFAULT_DELAY_MS = 450
const DEFAULT_MOVE_TOLERANCE_PX = 10

export function useLongPress({
  onLongPress,
  delayMs = DEFAULT_DELAY_MS,
  moveTolerancePx = DEFAULT_MOVE_TOLERANCE_PX,
}: UseLongPressOptions): UseLongPressResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<LongPressPoint | null>(null)
  const firedRef = useRef(false)

  // held in a ref, matching useFocusTrap.ts's onEscapeRef, so the timer
  // firing 450ms after pointerdown always calls the latest closure rather
  // than one captured from a stale render.
  const onLongPressRef = useRef(onLongPress)
  useEffect(() => {
    onLongPressRef.current = onLongPress
  })

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    clearTimer()
    startRef.current = null
  }, [clearTimer])

  const onPointerDown = useCallback(
    (point: LongPressPoint) => {
      startRef.current = point
      firedRef.current = false
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        firedRef.current = true
        onLongPressRef.current()
      }, delayMs)
    },
    [clearTimer, delayMs],
  )

  const onPointerMove = useCallback(
    (point: LongPressPoint) => {
      const start = startRef.current
      if (start === null) return
      const dx = point.clientX - start.clientX
      const dy = point.clientY - start.clientY
      if (Math.hypot(dx, dy) > moveTolerancePx) cancel()
    },
    [cancel, moveTolerancePx],
  )

  const shouldSuppressClick = useCallback(() => {
    const fired = firedRef.current
    firedRef.current = false
    return fired
  }, [])

  // unmounting mid-hold must not fire onLongPress against a gone component.
  useEffect(() => clearTimer, [clearTimer])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    shouldSuppressClick,
  }
}
