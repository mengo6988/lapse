import { QuickLogTile } from './QuickLogTile'
import type { HomeRow } from './homeRows'

interface QuickLogSectionProps {
  readonly rows: readonly HomeRow[]
  readonly now: Date
  readonly onTap?: (row: HomeRow) => void
}

/**
 * "quick log" section (docs/design.md § Home) — a 2-col tile grid. Renders
 * nothing at all (no label, no empty grid) when there are no candidates,
 * rather than showing a section with nothing in it.
 */
export function QuickLogSection({ rows, now, onTap }: QuickLogSectionProps) {
  if (rows.length === 0) return null

  return (
    <section aria-label="quick log" className="quick-log">
      <p className="quick-log__label">quick log</p>
      <div className="quick-log__tiles">
        {rows.map((row) => (
          <QuickLogTile key={row.id} row={row} now={now} onTap={onTap} />
        ))}
      </div>
    </section>
  )
}
