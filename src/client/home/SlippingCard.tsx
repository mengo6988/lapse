import { useRef } from 'react'
import { daysAgo } from '../domain/daysAgo'
import { urgencyRatio, urgencyState } from '../domain/urgency'
import type { ListRow } from '../domain/trackerRows'
import { logSheetStore } from '../log/logSheetStore'
import { useLongPress } from '../log/useLongPress'
import { formatDayCount, formatSlippingSubline } from './format'

interface SlippingCardProps {
  readonly row: ListRow
  readonly now: Date
  readonly onTap?: (row: ListRow) => void
  /**
   * build ticket 12: true for the 5s window after this row was tapped. The
   * card is pinned in its (frozen) slipping slot for that whole window even
   * though the row's own live urgency state has already flipped to fresh —
   * `urgencyState` below reflects that live state correctly (it never
   * special-cases this prop), so the count/settle class are the only things
   * this prop overrides.
   */
  readonly justLogged?: boolean
}

/**
 * one accent-bar card in the slipping section (docs/design.md § Home).
 * Normally only rendered for overdue/due-soon rows — selectSlippingRows
 * already filtered to those states — but a `justLogged` row is deliberately
 * an exception: src/client/log/applyFrozenOrder.ts keeps it in its frozen
 * slot with live (now-fresh) data, so `state` can read 'fresh' here too.
 * `thresholdDays`/`lastEntryAt` are still guaranteed non-null in both cases
 * (a thresholdless row is never selected into slipping, frozen or not), so
 * the non-null assertions below stay safe.
 *
 * Build ticket 13: this plain button also owns a long-press timer
 * (src/client/log/useLongPress.ts) that opens the log sheet directly via
 * `logSheetStore.open()` rather than a prop threaded from HomeRoute —
 * SlippingSection (build ticket 10) sits in between and doesn't forward a
 * long-press callback, so this is the only way in. No swipe wrapper here
 * (unlike list rows), so the hook's own cancel-on-move rule only has the
 * home digest's scroll to disambiguate against.
 */
export function SlippingCard({ row, now, onTap, justLogged = false }: SlippingCardProps) {
  const state = urgencyState(row.lastEntryAt, row.thresholdDays, now)
  const ratio = urgencyRatio(row.lastEntryAt, row.thresholdDays, now)!
  const count = daysAgo(row.lastEntryAt, now)!
  const countLabel = justLogged ? 'now' : formatDayCount(count)
  const className = `slipping-card slipping-card--${state} log-pressable${justLogged ? ' log-settle' : ''}`

  const buttonRef = useRef<HTMLButtonElement>(null)
  const longPress = useLongPress({
    onLongPress: () =>
      logSheetStore.open({ trackerId: row.trackerId, variantId: row.variantId }, buttonRef.current),
  })

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      onKeyDown={longPress.onKeyDown}
      onKeyUp={longPress.onKeyUp}
      onClick={() => {
        if (longPress.shouldSuppressClick()) return
        onTap?.(row)
      }}
    >
      <span className="slipping-card__body">
        <span className="slipping-card__name">
          {row.name}
          {row.variantName !== null && (
            <span className="slipping-card__variant"> · {row.variantName}</span>
          )}
        </span>
        <span className="slipping-card__sub">
          {formatSlippingSubline(state, row.thresholdDays!, ratio)}
        </span>
      </span>
      <span className="slipping-card__count">{countLabel}</span>
    </button>
  )
}
