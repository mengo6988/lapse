/**
 * row-level copy for the list ledger (docs/design.md § List). the "day
 * count" both here and in the domain's own doc comment means whole,
 * local-midnight-bucketed days — this module deliberately never shows an
 * hour-granularity count (the earlier `06-chosen-direction-ledger-mocha`
 * mock's "9h" example predates domain/daysAgo.ts's committed contract,
 * which only ever returns whole days; the mock loses to the landed domain
 * module here).
 *
 * all day math comes from domain/daysAgo — this module only builds strings
 * around it.
 */
import { daysAgo } from '../domain/daysAgo'
import type { ListRow } from '../domain/trackerRows'

const NEVER_DASH = '—'

export function formatRowCount(row: ListRow, now: Date): string {
  const days = daysAgo(row.lastEntryAt, now)
  return days === null ? NEVER_DASH : `${days}d`
}

export function formatRowSubline(row: ListRow, now: Date): string {
  const days = daysAgo(row.lastEntryAt, now)
  const lastDone = days === null ? 'never' : `${days}d ago`
  const thresholdClause = row.thresholdDays === null ? null : `every ${row.thresholdDays}d`

  return thresholdClause === null
    ? `last done ${lastDone}`
    : `last done ${lastDone} · ${thresholdClause}`
}
