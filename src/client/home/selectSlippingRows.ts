import { sortByUrgency } from '../domain/sort'
import type { ListRow } from '../domain/trackerRows'
import { urgencyState } from '../domain/urgency'

const SLIPPING_LIMIT = 3

/**
 * top rows for the slipping section (docs/design.md § Home): due-soon and
 * overdue only. `never` rows (thresholded, unlogged) sort ahead of these in
 * the full urgency order but don't belong here — build ticket 10's "nothing
 * slipping" empty state fires only when nothing is due-soon or overdue.
 */
export function selectSlippingRows(rows: readonly ListRow[], now: Date): ListRow[] {
  return sortByUrgency(rows, now)
    .filter((row) => {
      const state = urgencyState(row.lastEntryAt, row.thresholdDays, now)
      return state === 'overdue' || state === 'due-soon'
    })
    .slice(0, SLIPPING_LIMIT)
}
