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
 * How far past (or short of) its threshold a row is, in words: "Nd over",
 * "due tomorrow", "due in Nd" — or null for a state that isn't slipping.
 *
 * Shared with the list ledger (src/client/list/formatListRow.ts) rather than
 * written twice: it is the only text anywhere that distinguishes overdue from
 * due-soon from fresh, since the accent bar carrying that distinction is
 * `aria-hidden` on both surfaces. Two copies of this wording would be two
 * places for the two screens to start disagreeing about what "over" means.
 *
 * `elapsedDays` is recovered from the already-computed ratio (ratio ×
 * threshold) rather than re-derived from lastEntryAt — this re-uses
 * domain/urgency's own math, it doesn't add new domain logic.
 */
export function formatUrgencyClause(
  state: UrgencyState,
  thresholdDays: number,
  ratio: number,
): string | null {
  const elapsedDays = ratio * thresholdDays

  if (state === 'overdue') {
    return `${Math.round(elapsedDays - thresholdDays)}d over`
  }

  if (state === 'due-soon') {
    const daysLeft = Math.ceil(thresholdDays - elapsedDays)
    return daysLeft <= 1 ? 'due tomorrow' : `due in ${daysLeft}d`
  }

  return null
}

/**
 * slipping card subline: "every Yd · Nd over" (overdue) or "every Yd · due
 * tomorrow / due in Nd" (due-soon), per docs/design.md § Home and the
 * committed prototype.
 */
export function formatSlippingSubline(
  state: UrgencyState,
  thresholdDays: number,
  ratio: number,
): string {
  const clause = formatUrgencyClause(state, thresholdDays, ratio)

  // fresh/never/neutral never reach the slipping section; kept total for safety.
  return clause === null ? `every ${thresholdDays}d` : `every ${thresholdDays}d · ${clause}`
}
