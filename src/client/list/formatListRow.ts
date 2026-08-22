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
import { urgencyRatio } from '../domain/urgency'
import { formatUrgencyClause } from '../home/format'

const NEVER_DASH = '—'

export function formatRowCount(row: ListRow, now: Date): string {
  const days = daysAgo(row.lastEntryAt, now)
  return days === null ? NEVER_DASH : `${days}d`
}

/**
 * "last done 12d ago · every 7d · 5d over".
 *
 * The third clause is what makes this row's urgency readable at all. The row
 * renders overdue, due-soon and fresh identically apart from the colour of an
 * `aria-hidden` accent bar (src/client/list/list.css), so before this clause
 * a screen reader read the three states as the same sentence and a
 * red/green-confusable eye saw the same row — on the screen docs/design.md
 * calls the full sorted view of what needs attention. `never` and
 * thresholdless rows were always distinguishable (an em-dash count and a
 * dotted bar; no "every Yd" at all) and are left alone.
 */
export function formatRowSubline(row: ListRow, now: Date): string {
  const days = daysAgo(row.lastEntryAt, now)
  const lastDone = days === null ? 'never' : `${days}d ago`

  if (row.thresholdDays === null) return `last done ${lastDone}`

  const ratio = urgencyRatio(row.lastEntryAt, row.thresholdDays, now)
  const urgencyClause =
    ratio === null ? null : formatUrgencyClause(row.urgency, row.thresholdDays, ratio)

  const clauses = [`last done ${lastDone}`, `every ${row.thresholdDays}d`, urgencyClause]
  return clauses.filter((clause) => clause !== null).join(' · ')
}
