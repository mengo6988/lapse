import type { UrgencyState } from '../domain/urgency'

/** big count on a slipping card, e.g. "74d" — docs/design.md § Home. */
export function formatDayCount(days: number): string {
  return `${days}d`
}

/** quick-log tile subline, e.g. "9d ago" / "never" — docs/design.md § Home. */
export function formatAgeLabel(days: number | null): string {
  if (days === null) return 'never'
  if (days === 0) return 'today'
  return `${days}d ago`
}

/**
 * slipping card subline: "every Yd · Nd over" (overdue) or "every Yd · due
 * tomorrow / due in Nd" (due-soon), per docs/design.md § Home and the
 * committed prototype. `elapsedDays` is recovered from the already-computed
 * ratio (ratio × threshold) rather than re-deriving it from lastEntryAt —
 * this only re-uses domain/urgency's own math, not new domain logic.
 */
export function formatSlippingSubline(
  state: UrgencyState,
  thresholdDays: number,
  ratio: number,
): string {
  const elapsedDays = ratio * thresholdDays

  if (state === 'overdue') {
    const over = Math.round(elapsedDays - thresholdDays)
    return `every ${thresholdDays}d · ${over}d over`
  }

  if (state === 'due-soon') {
    const daysLeft = Math.ceil(thresholdDays - elapsedDays)
    return `every ${thresholdDays}d · ${daysLeft <= 1 ? 'due tomorrow' : `due in ${daysLeft}d`}`
  }

  // fresh/never/neutral never reach the slipping section; kept total for safety.
  return `every ${thresholdDays}d`
}
