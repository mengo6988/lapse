/**
 * The header chip that says logs are waiting to reach the server (build
 * ticket 19, docs/design.md § Feel: "mono chip in home header — '2 queued'
 * + clock glyph in overlay2, peach when any entry failed"). Reuses
 * ActivityIcon (src/client/shell/icons.tsx) as the clock glyph rather than
 * drawing a new one — it's already the app's clock/history glyph.
 *
 * Subscribes directly to `useOutboxItems()` (src/client/outbox/
 * outboxStore.ts), so it renders nothing while the queue is empty and
 * disappears on its own the instant the queue drains — no dismiss action
 * to wire up, per this ticket's acceptance criteria.
 *
 * `openedFrom` is both "is the sheet open" and the focus-restore target for
 * useFocusTrap once it closes, mirroring src/client/settings/
 * CategoriesManager.tsx's `deleteRequest` pattern — one piece of state
 * instead of two. This ticket's instructions are explicit that the sheet
 * gets no module-level store of its own: PendingChip is its only entry
 * point, so plain local state is enough.
 */
import { useState } from 'react'
import { ActivityIcon } from '../shell/icons'
import { useExitTransition } from '../shell/useExitTransition'
import { useOutboxItems } from './outboxStore'
import { QueuedSheet } from './QueuedSheet'
import './outbox.css'

export function PendingChip() {
  const items = useOutboxItems()
  const [openedFrom, setOpenedFrom] = useState<HTMLElement | null>(null)
  // both latches hold their element mounted through a 200ms exit fade — the
  // chip's disappearance when the queue drains is the quiet "your log
  // landed" signal, and shouldn't be a blink.
  const chip = useExitTransition(items.length > 0 ? items : null)
  const sheet = useExitTransition(openedFrom)

  const chipItems = chip.value ?? []
  const hasDeadItems = chipItems.some((item) => item.status === 'dead')
  const stateClass = hasDeadItems ? 'pending-chip pending-chip--dead' : 'pending-chip'
  const className = chip.closing ? `${stateClass} pending-chip--out` : stateClass

  /**
   * The live region is the wrapper, not the chip, and it stays mounted while
   * the queue is empty. A screen reader announces *changes inside* a live
   * region it was already watching — inserting the region and its content in
   * the same breath is the case that reliably says nothing. Since the chip is
   * the only signal that a log hasn't landed (LogToast.tsx carries
   * role="status" for the same reason, and the two sit side by side in the
   * header), it going silent is the whole failure.
   *
   * An empty wrapper is a zero-width flex item between the wordmark and the
   * magnifier, so the header lays out exactly as it did.
   */
  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {chip.value !== null && (
          <button
            type="button"
            className={className}
            /*
             * The dead-letter state is peach and nothing else on screen
             * (outbox.css), so the label is the only place it is not
             * colour-only. Visible copy stays the canonical "N queued"
             * from docs/design.md's strings table.
             */
            aria-label={hasDeadItems ? `${items.length} queued, some failed` : undefined}
            onClick={(event) => setOpenedFrom(event.currentTarget)}
          >
            <ActivityIcon className="pending-chip__icon" width={14} height={14} />
            <span>{chipItems.length} queued</span>
          </button>
        )}
      </div>

      {sheet.value && (
        <QueuedSheet restoreFocusTo={sheet.value} onClose={() => setOpenedFrom(null)} closing={sheet.closing} />
      )}
    </>
  )
}
