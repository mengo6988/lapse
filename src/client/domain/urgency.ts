/**
 * Urgency per docs/spec.md § Domain rules. Pure: no clock of its own, no I/O —
 * every caller passes `now` so tests and renders agree.
 */

export type UrgencyState = 'never' | 'fresh' | 'due-soon' | 'overdue' | 'neutral'

const MS_PER_DAY = 86_400_000

/**
 * Days since `lastEntryAt` divided by the threshold, or null when the ratio is
 * undefined (no threshold, or nothing logged yet). A future entry time reads as
 * zero rather than negative — the outbox can replay a slightly-skewed clock.
 */
export function urgencyRatio(
  lastEntryAt: string | null,
  thresholdDays: number | null,
  now: Date,
): number | null {
  if (thresholdDays === null || lastEntryAt === null) return null

  const elapsedDays = (now.getTime() - new Date(lastEntryAt).getTime()) / MS_PER_DAY
  return Math.max(0, elapsedDays) / thresholdDays
}

export function urgencyState(
  lastEntryAt: string | null,
  thresholdDays: number | null,
  now: Date,
): UrgencyState {
  if (thresholdDays === null) return 'neutral'
  if (lastEntryAt === null) return 'never'

  const ratio = urgencyRatio(lastEntryAt, thresholdDays, now)!
  if (ratio >= 1) return 'overdue'
  if (ratio >= 0.8) return 'due-soon'
  return 'fresh'
}
