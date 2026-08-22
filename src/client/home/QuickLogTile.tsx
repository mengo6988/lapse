import { useRef } from 'react'
import { daysAgo } from '../domain/daysAgo'
import type { ListRow } from '../domain/trackerRows'
import { logSheetStore } from '../log/logSheetStore'
import { useLongPress } from '../log/useLongPress'
import { formatAgeLabel } from './format'

interface QuickLogTileProps {
  readonly row: ListRow
  readonly now: Date
  readonly onTap?: (row: ListRow) => void
  /** build ticket 12: true for the 5s window after this row was tapped — shows "now" instead of the usual day-bucketed age. */
  readonly justLogged?: boolean
}

/**
 * one tile in the quick-log grid (docs/design.md § Home): name + "Xd
 * ago"/"never", no accent colour.
 *
 * Build ticket 13: also owns a long-press timer (src/client/log/
 * useLongPress.ts) that opens the log sheet directly via
 * `logSheetStore.open()` rather than a prop threaded from HomeRoute —
 * QuickLogSection (build ticket 10) sits in between and doesn't forward a
 * long-press callback, so this is the only way in. No swipe wrapper here
 * (unlike list rows), so the hook's own cancel-on-move rule only has the
 * home digest's scroll to disambiguate against.
 */
export function QuickLogTile({ row, now, onTap, justLogged = false }: QuickLogTileProps) {
  const count = daysAgo(row.lastEntryAt, now)
  const ageLabel = justLogged ? 'now' : formatAgeLabel(count)
  const className = `quick-log-tile log-pressable${justLogged ? ' log-settle' : ''}`

  const buttonRef = useRef<HTMLButtonElement>(null)
  const longPress = useLongPress({
    onLongPress: () =>
      logSheetStore.open({ trackerId: row.trackerId, variantId: row.variantId }, buttonRef.current),
  })

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      onKeyDown={longPress.onKeyDown}
      onKeyUp={longPress.onKeyUp}
      onClick={() => {
        if (longPress.shouldSuppressClick()) return
        onTap?.(row)
      }}
    >
      <span className="quick-log-tile__name">
        {row.name}
        {row.variantName !== null && (
          <span className="quick-log-tile__variant"> · {row.variantName}</span>
        )}
      </span>
      <span className="quick-log-tile__sub">{ageLabel}</span>
    </button>
  )
}
