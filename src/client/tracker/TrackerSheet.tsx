/**
 * Sheet chrome: grabber, title, explicit close button (docs/design.md — a
 * standalone PWA has no OS back gesture, so every non-tab screen needs its
 * own back/close affordance) and swipe-down-to-dismiss on the grabber,
 * matching the log sheet reference (.scratch/lapse-v1/assets/12-home-
 * prototype.html). Content itself is TrackerForm, passed as children.
 *
 * The grabber drag follows the finger via `dragY` (translateY, floored at
 * 0 — never drags upward past rest) up to the same 60px dismissal
 * threshold. Release past it calls `onClose()`, handing off to the
 * existing `--closing`/`sheet-out` exit (src/client/shell/useExitTransition.ts);
 * short of it, `dragY` resets to 0 and an inline `transition` (present only
 * while not actively dragging, so the follow itself stays instant) springs
 * it back. `prefers-reduced-motion` skips the follow entirely and keeps the
 * old binary-threshold behaviour: nothing moves until the threshold is
 * crossed, then straight to `onClose()`.
 */
import { useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { CloseIcon } from '../shell/icons'

const SWIPE_DOWN_THRESHOLD_PX = 60

interface TrackerSheetProps {
  title: string
  onClose: () => void
  containerRef: RefObject<HTMLDivElement>
  /** true while the host plays the exit animation — see src/client/shell/useExitTransition.ts. */
  closing?: boolean
  children: ReactNode
}

/** jsdom (see TrackerSheet.test.tsx) has no matchMedia — treat that as "not reduced". */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function TrackerSheet({ title, onClose, containerRef, closing = false, children }: TrackerSheetProps) {
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY
    setDragY(0)
    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return
    const delta = event.clientY - dragStartY.current

    if (prefersReducedMotion()) {
      if (delta > SWIPE_DOWN_THRESHOLD_PX) {
        dragStartY.current = null
        setDragging(false)
        onClose()
      }
      return
    }

    setDragY(Math.max(0, delta))
  }

  // Shared by pointerup and pointercancel (which can fire mid-gesture, e.g.
  // the OS taking over the pointer) — both end the drag the same way.
  function endDrag() {
    dragStartY.current = null
    setDragging(false)
    if (dragY > SWIPE_DOWN_THRESHOLD_PX) {
      onClose()
    } else {
      setDragY(0)
    }
  }

  return (
    <div
      className={closing ? 'tracker-sheet tracker-sheet--closing' : 'tracker-sheet'}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={containerRef}
      tabIndex={-1}
      style={
        closing
          ? undefined
          : {
              transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
              transition: dragging ? 'none' : 'transform var(--duration-press) var(--ease-spring)',
            }
      }
    >
      <div
        className="tracker-sheet__grabber"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="tracker-sheet__header">
        <h2 className="tracker-sheet__title">{title}</h2>
        <button type="button" className="icon-button tracker-sheet__close" aria-label="close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {children}
    </div>
  )
}
