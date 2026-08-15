/**
 * Wraps a list row's existing markup with the swipe-left-to-reveal
 * "details" action (docs/design.md § List, § Navigation: "swipe left on a
 * row reveals a single details action, which opens the Tracker detail
 * screen. This is the only way into detail"). Renders an `<li>` — the only
 * intended host is `src/client/list/ListRowItem.tsx`, which already renders
 * one `<li>` per row.
 *
 * Prop contract: `children` is the row's existing inner markup (unchanged);
 * `className` is applied to the sliding content surface, so a caller's row
 * styling (e.g. `list-row list-row--${row.urgency}`) keeps working exactly
 * as it did directly on the `<li>`; `onDetails` fires once, however the
 * action was activated.
 *
 * Accessibility: the "details" button is a real, always-mounted `<button>`
 * — reachable by Tab/screen readers with no gesture at all, per
 * docs/design.md's requirement that the swipe alone must not be the only
 * path in. Focusing it also reveals the row visually (not just logically),
 * so a sighted keyboard user sees the same reveal a touch user would swipe
 * into. The reveal/conceal animation itself is defined in detail.css and
 * disabled under `prefers-reduced-motion`.
 */
import { useRef, type MouseEvent, type ReactNode } from 'react'
import './detail.css'
import { useSwipeReveal } from './useSwipeReveal'

export interface SwipeRevealRowProps {
  /** the row's own content, rendered inside the sliding surface. */
  children: ReactNode
  /** fires once when the details action is activated, by gesture or button. */
  onDetails: () => void
  /** applied to the sliding content element, alongside `swipe-row__content`. */
  className?: string
  /** accessible name for the revealed action. Defaults to 'details'. */
  detailsLabel?: string
}

const REVEAL_WIDTH_PX = 84

export function SwipeRevealRow({ children, onDetails, className, detailsLabel = 'details' }: SwipeRevealRowProps) {
  const swipe = useSwipeReveal({ revealWidthPx: REVEAL_WIDTH_PX })
  const justSwipedRef = useRef(false)

  function activate() {
    swipe.conceal()
    onDetails()
  }

  /**
   * The row's children are the tap-to-log button (ticket 12), so a pointer
   * gesture that was meant to reveal must not also fall through as a tap —
   * swiping to browse history would otherwise silently log an Entry. Ends of
   * a swipe, and taps on an already-revealed row, are both swallowed here;
   * the latter closes the row instead, which is what a tap on an open row
   * reads as.
   */
  function onContentClickCapture(event: MouseEvent) {
    if (justSwipedRef.current) {
      justSwipedRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (swipe.revealed) {
      event.preventDefault()
      event.stopPropagation()
      swipe.conceal()
    }
  }

  return (
    <li className="swipe-row">
      <div
        className={`swipe-row__content${className ? ` ${className}` : ''}`}
        style={{ transform: `translateX(${swipe.offsetX}px)` }}
        onPointerDown={(event) => swipe.onPointerDown(event)}
        onPointerMove={(event) => swipe.onPointerMove(event)}
        onPointerUp={() => {
          justSwipedRef.current = swipe.onPointerUp()
        }}
        onPointerCancel={swipe.onPointerCancel}
        onClickCapture={onContentClickCapture}
      >
        {children}
      </div>
      <div className="swipe-row__actions" style={{ width: REVEAL_WIDTH_PX }}>
        <button type="button" className="swipe-row__action" onClick={activate} onFocus={swipe.reveal} onBlur={swipe.conceal}>
          {detailsLabel}
        </button>
      </div>
    </li>
  )
}
