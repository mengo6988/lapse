import { formatRowCount, formatRowSubline } from './formatListRow'
import type { ListRow } from './buildListRows'

interface ListRowItemProps {
  row: ListRow
  now: Date
}

/**
 * one ledger row (docs/design.md § List). urgency is never colour-only:
 * `never` pairs a dotted bar with an em-dash count and an italic
 * de-emphasised name; `neutral` (thresholdless) drops the bar entirely and
 * de-emphasises the name without italics; overdue/due-soon/fresh get a
 * solid bar whose colour is the only thing that changes between them (the
 * three-way state is still legible from the count/subline text, not colour
 * alone). tap-to-log lands in ticket 12 — this row is read-only for now.
 */
export function ListRowItem({ row, now }: ListRowItemProps) {
  const isDash = row.lastEntryAt === null
  const countModifier = isDash ? 'dash' : row.urgency === 'neutral' ? 'neutral' : 'default'

  return (
    <li className={`list-row list-row--${row.urgency}`}>
      <div className="list-row__body">
        <p className={`list-row__name list-row__name--${row.urgency}`}>
          {row.name}
          {row.variantName !== null && <span className="list-row__variant"> · {row.variantName}</span>}
        </p>
        <p className="list-row__sub">{formatRowSubline(row, now)}</p>
      </div>
      <div className="list-row__right">
        <span className={`list-row__count list-row__count--${countModifier}`}>
          {formatRowCount(row, now)}
        </span>
        {row.urgency !== 'neutral' && (
          <span className={`list-row__bar list-row__bar--${row.urgency}`} aria-hidden="true" />
        )}
      </div>
    </li>
  )
}
