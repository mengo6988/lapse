/**
 * Sheet chrome: grabber, title, explicit close button (docs/design.md — a
 * standalone PWA has no OS back gesture, so every non-tab screen needs its
 * own back/close affordance) and swipe-down-to-dismiss on the grabber,
 * matching the log sheet reference (.scratch/lapse-v1/assets/12-home-
 * prototype.html). Content itself is TrackerForm, passed as children.
 */
import { useRef, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { CloseIcon } from '../shell/icons'

const SWIPE_DOWN_THRESHOLD_PX = 60

interface TrackerSheetProps {
  title: string
  onClose: () => void
  containerRef: RefObject<HTMLDivElement>
  children: ReactNode
}

export function TrackerSheet({ title, onClose, containerRef, children }: TrackerSheetProps) {
  const dragStartY = useRef<number | null>(null)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return
    if (event.clientY - dragStartY.current > SWIPE_DOWN_THRESHOLD_PX) {
      dragStartY.current = null
      onClose()
    }
  }

  function handlePointerUp() {
    dragStartY.current = null
  }

  return (
    <div className="tracker-sheet" role="dialog" aria-modal="true" aria-label={title} ref={containerRef} tabIndex={-1}>
      <div
        className="tracker-sheet__grabber"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
