import { daysAgo } from '../domain/daysAgo'
import { formatAgeLabel } from './format'
import type { HomeRow } from './homeRows'

interface QuickLogTileProps {
  readonly row: HomeRow
  readonly now: Date
  readonly onTap?: (row: HomeRow) => void
  /** build ticket 12: true for the 5s window after this row was tapped — shows "now" instead of the usual day-bucketed age. */
  readonly justLogged?: boolean
}

/** one tile in the quick-log grid (docs/design.md § Home): name + "Xd ago"/"never", no accent colour. */
export function QuickLogTile({ row, now, onTap, justLogged = false }: QuickLogTileProps) {
  const count = daysAgo(row.lastEntryAt, now)
  const ageLabel = justLogged ? 'now' : formatAgeLabel(count)
  const className = `quick-log-tile${justLogged ? ' log-settle' : ''}`

  return (
    <button type="button" className={className} onClick={onTap ? () => onTap(row) : undefined}>
      <span className="quick-log-tile__name">
        {row.name}
        {row.variantLabel !== null && (
          <span className="quick-log-tile__variant"> · {row.variantLabel}</span>
        )}
      </span>
      <span className="quick-log-tile__sub">{ageLabel}</span>
    </button>
  )
}
