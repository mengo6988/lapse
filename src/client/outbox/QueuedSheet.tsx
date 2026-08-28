/**
 * The sheet the pending chip opens (build ticket 19, docs/design.md § Feel:
 * "tap → sheet listing queued/failed entries with retry-all / per-entry
 * discard"). Reuses the create/edit Tracker sheet's chrome exactly as
 * src/client/log/LogSheetHost.tsx does — grabber, title, close button,
 * swipe-down, scrim, and useFocusTrap — rather than building new sheet
 * chrome, per this ticket's instructions.
 *
 * Subscribes to the same `useOutboxItems()` the chip does, so the row list
 * updates live as the drain loop (build ticket 17, out of this ticket's
 * fence) works through the queue in the background. When the queue empties
 * underneath it — everything drained, or the last item got discarded —
 * there is nothing left to show, so this closes itself via `onClose` rather
 * than rendering an empty sheet.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useBootstrapQuery } from '../query/useBootstrap'
import { useInertBackground } from '../shell/useInertBackground'
import { useFocusTrap } from '../tracker/useFocusTrap'
import { TrackerSheet } from '../tracker/TrackerSheet'
import { resolveQueuedLabel } from './queuedLabel'
import { removeOutboxItem, retryAllOutboxItems, useOutboxItems, type OutboxItem } from './outboxStore'

interface QueuedSheetProps {
  onClose: () => void
  restoreFocusTo: HTMLElement | null
  /** true while the caller plays the exit animation — see src/client/shell/useExitTransition.ts. */
  closing?: boolean
}

function rowClassName(item: OutboxItem): string {
  return item.status === 'dead' ? 'queued-sheet__row queued-sheet__row--dead' : 'queued-sheet__row'
}

export function QueuedSheet({ onClose, restoreFocusTo, closing = false }: QueuedSheetProps) {
  const items = useOutboxItems()
  const { data: bootstrap } = useBootstrapQuery()
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose, restoreFocusTo)
  // this component is only ever mounted (by PendingChip.tsx) for the sheet's
  // full open + exit-latch lifetime, so "mounted" already is "active" — see
  // src/client/shell/useInertBackground.ts.
  useInertBackground(true)

  useEffect(() => {
    if (items.length === 0) onClose()
  }, [items.length, onClose])

  // portaled to document.body so the sheet lands as a DOM sibling of
  // #app-root, not a descendant — see useInertBackground.ts's doc comment.
  return createPortal(
    <>
      <div className={closing ? 'tracker-sheet-scrim tracker-sheet-scrim--closing' : 'tracker-sheet-scrim'} onClick={onClose} />
      <TrackerSheet title="queued" onClose={onClose} containerRef={containerRef} closing={closing}>
        <div className="queued-sheet">
          {/*
            Always enabled while the sheet is open, even when nothing has
            dead-lettered. `retryAllOutboxItems` only revives dead items, but
            it commits either way, and that store emit is what wakes the drain
            loop (build ticket 17) — so on a queue of merely-waiting items this
            button means "try now", which is exactly what someone who just got
            their signal back opens this sheet to do. Disabling it would kill
            the affordance in the one situation it is most wanted.
          */}
          <button
            type="button"
            className="queued-sheet__retry-all"
            onClick={() => void retryAllOutboxItems()}
          >
            retry all
          </button>

          {items.length === 0 ? (
            <p className="queued-sheet__empty">nothing queued</p>
          ) : (
            <ul className="queued-sheet__list">
              {items.map((item) => {
                const label = resolveQueuedLabel(item, bootstrap)
                return (
                  <li key={item.id} className={rowClassName(item)}>
                    <div className="queued-sheet__row-info">
                      <span className="queued-sheet__row-name">{label.name}</span>
                      <span className="queued-sheet__row-time">{label.time}</span>
                      {item.status === 'dead' && <span className="queued-sheet__row-status">failed</span>}
                    </div>
                    <button
                      type="button"
                      className="queued-sheet__discard"
                      aria-label={`discard ${label.name}`}
                      onClick={() => void removeOutboxItem(item.id)}
                    >
                      discard
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </TrackerSheet>
    </>,
    document.body,
  )
}
