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
import { useOutboxItems } from './outboxStore'
import { QueuedSheet } from './QueuedSheet'
import './outbox.css'

export function PendingChip() {
  const items = useOutboxItems()
  const [openedFrom, setOpenedFrom] = useState<HTMLElement | null>(null)

  if (items.length === 0) return null

  const hasDeadItems = items.some((item) => item.status === 'dead')
  const className = hasDeadItems ? 'pending-chip pending-chip--dead' : 'pending-chip'

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={(event) => setOpenedFrom(event.currentTarget)}
      >
        <ActivityIcon className="pending-chip__icon" width={14} height={14} />
        <span>{items.length} queued</span>
      </button>

      {openedFrom && <QueuedSheet restoreFocusTo={openedFrom} onClose={() => setOpenedFrom(null)} />}
    </>
  )
}
