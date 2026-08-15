import { daysAgo } from '../domain/daysAgo'
import { urgencyRatio, urgencyState } from '../domain/urgency'
import { formatDayCount, formatSlippingSubline } from './format'
import type { HomeRow } from './homeRows'

interface SlippingCardProps {
  readonly row: HomeRow
  readonly now: Date
  readonly onTap?: (row: HomeRow) => void
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
 */
export function SlippingCard({ row, now, onTap, justLogged = false }: SlippingCardProps) {
  const state = urgencyState(row.lastEntryAt, row.thresholdDays, now)
  const ratio = urgencyRatio(row.lastEntryAt, row.thresholdDays, now)!
  const count = daysAgo(row.lastEntryAt, now)!
  const countLabel = justLogged ? 'now' : formatDayCount(count)
  const className = `slipping-card slipping-card--${state}${justLogged ? ' log-settle' : ''}`

  return (
    <button type="button" className={className} onClick={onTap ? () => onTap(row) : undefined}>
      <span className="slipping-card__body">
        <span className="slipping-card__name">
          {row.name}
          {row.variantLabel !== null && (
            <span className="slipping-card__variant"> · {row.variantLabel}</span>
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
