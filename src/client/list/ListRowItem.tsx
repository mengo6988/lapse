import { SwipeRevealRow } from '../detail'
import { formatRowCount, formatRowSubline } from './formatListRow'
import type { ListRow } from './buildListRows'

interface ListRowItemProps {
  row: ListRow
  now: Date
  onTap?: (row: ListRow) => void
  /** build ticket 12: true for the 5s window after this row was tapped — shows "now" instead of the usual day-bucketed count. */
  justLogged?: boolean
  /** build ticket 15: opens the Tracker detail screen, revealed by swiping the row left. */
  onOpenDetail?: (row: ListRow) => void
}

/**
 * one ledger row (docs/design.md § List). urgency is never colour-only:
 * `never` pairs a dotted bar with an em-dash count and an italic
 * de-emphasised name; `neutral` (thresholdless) drops the bar entirely and
 * de-emphasises the name without italics; overdue/due-soon/fresh get a
 * solid bar whose colour is the only thing that changes between them (the
 * three-way state is still legible from the count/subline text, not colour
 * alone). The `<li>` carries the urgency classes/divider (list semantics,
 * and what ticket 11's freeze/sort ordering keys off of); a `<button>`
 * fills the whole row so the entire tap target is real and 44px+, per
 * ticket 12's accessibility requirement — `<span>`s inside it, not `<p>`s,
 * since `<button>`'s content model doesn't allow block-level children.
 *
 * SwipeRevealRow (ticket 15) renders the `<li>` and adds the swipe-left
 * "details" action that is the only way into the detail screen — it also
 * swallows the click that ends a swipe, so revealing a row never falls
 * through to the tap-to-log button underneath.
 */
export function ListRowItem({ row, now, onTap, justLogged = false, onOpenDetail }: ListRowItemProps) {
  const isDash = row.lastEntryAt === null
  const countModifier = isDash ? 'dash' : row.urgency === 'neutral' ? 'neutral' : 'default'
  const countText = justLogged ? 'now' : formatRowCount(row, now)
  const buttonClassName = `list-row__button${justLogged ? ' log-settle' : ''}`

  return (
    <SwipeRevealRow
      className={`list-row list-row--${row.urgency}`}
      onDetails={() => onOpenDetail?.(row)}
    >
      <button type="button" className={buttonClassName} onClick={onTap ? () => onTap(row) : undefined}>
        <span className="list-row__body">
          <span className={`list-row__name list-row__name--${row.urgency}`}>
            {row.name}
            {row.variantName !== null && <span className="list-row__variant"> · {row.variantName}</span>}
          </span>
          <span className="list-row__sub">{formatRowSubline(row, now)}</span>
        </span>
        <span className="list-row__right">
          <span className={`list-row__count list-row__count--${countModifier}`}>{countText}</span>
          {row.urgency !== 'neutral' && (
            <span className={`list-row__bar list-row__bar--${row.urgency}`} aria-hidden="true" />
          )}
        </span>
      </button>
    </SwipeRevealRow>
  )
}
