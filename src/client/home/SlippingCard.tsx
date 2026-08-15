import { daysAgo } from '../domain/daysAgo'
import { urgencyRatio, urgencyState } from '../domain/urgency'
import { formatDayCount, formatSlippingSubline } from './format'
import type { HomeRow } from './homeRows'

interface SlippingCardProps {
  readonly row: HomeRow
  readonly now: Date
  /** ticket 12's seam: not wired here, tapping is currently inert. */
  readonly onTap?: (row: HomeRow) => void
}

/**
 * one accent-bar card in the slipping section (docs/design.md § Home). Only
 * ever rendered for overdue/due-soon rows — selectSlippingRows already
 * filtered to those states, so the non-null assertions below (ratio,
 * lastEntryAt, threshold) are safe, mirroring the same pattern used in
 * domain/sort.ts's own bucket-guarded assertions.
 */
export function SlippingCard({ row, now, onTap }: SlippingCardProps) {
  const state = urgencyState(row.lastEntryAt, row.thresholdDays, now)
  const ratio = urgencyRatio(row.lastEntryAt, row.thresholdDays, now)!
  const count = daysAgo(row.lastEntryAt, now)!

  return (
    <button
      type="button"
      className={`slipping-card slipping-card--${state}`}
      onClick={onTap ? () => onTap(row) : undefined}
    >
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
      <span className="slipping-card__count">{formatDayCount(count)}</span>
    </button>
  )
}
