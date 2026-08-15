import type { HomeRow } from './homeRows'

const QUICK_LOG_LIMIT = 6

/**
 * quick-log candidates per docs/design.md § Home ("frequently/recently
 * logged Trackers"). Bootstrap carries only each row's latest Entry, no
 * frequency counts, so recency is the only proxy available without an
 * extra fetch — see build ticket 10's report for this call. Rows already
 * shown in the slipping section are excluded so no tap target repeats on
 * screen; never-logged rows sort last rather than being dropped, so an
 * unstarted Tracker can still surface as a suggestion.
 */
export function selectQuickLogRows(
  rows: readonly HomeRow[],
  excludeIds: ReadonlySet<string>,
  now: Date,
): HomeRow[] {
  return [...rows]
    .filter((row) => !excludeIds.has(row.id))
    .sort((a, b) => recencyRank(a, now) - recencyRank(b, now))
    .slice(0, QUICK_LOG_LIMIT)
}

function recencyRank(row: HomeRow, now: Date): number {
  if (row.lastEntryAt === null) return Number.POSITIVE_INFINITY
  return now.getTime() - new Date(row.lastEntryAt).getTime()
}
