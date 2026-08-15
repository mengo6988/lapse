import { daysAgo } from '../domain/daysAgo'
import { formatAgeLabel } from './format'
import type { HomeRow } from './homeRows'

interface QuickLogTileProps {
  readonly row: HomeRow
  readonly now: Date
  /** ticket 12's seam: not wired here, tapping is currently inert. */
  readonly onTap?: (row: HomeRow) => void
}

/** one tile in the quick-log grid (docs/design.md § Home): name + "Xd ago"/"never", no accent colour. */
export function QuickLogTile({ row, now, onTap }: QuickLogTileProps) {
  const count = daysAgo(row.lastEntryAt, now)

  return (
    <button
      type="button"
      className="quick-log-tile"
      onClick={onTap ? () => onTap(row) : undefined}
    >
      <span className="quick-log-tile__name">
        {row.name}
        {row.variantLabel !== null && (
          <span className="quick-log-tile__variant"> · {row.variantLabel}</span>
        )}
      </span>
      <span className="quick-log-tile__sub">{formatAgeLabel(count)}</span>
    </button>
  )
}
