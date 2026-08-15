import { SlippingCard } from './SlippingCard'
import type { HomeRow } from './homeRows'

interface SlippingSectionProps {
  readonly rows: readonly HomeRow[]
  readonly now: Date
  readonly onTap?: (row: HomeRow) => void
}

/**
 * "slipping" section (docs/design.md § Home): the top overdue/due-soon rows
 * as accent-bar cards, or the "nothing slipping" empty state (build ticket
 * 10 acceptance criterion) when there are none.
 */
export function SlippingSection({ rows, now, onTap }: SlippingSectionProps) {
  return (
    <section aria-label="slipping" className="slipping">
      <p className="slipping__label">slipping</p>
      {rows.length === 0 ? (
        <p className="slipping__empty">nothing slipping</p>
      ) : (
        <div className="slipping__cards">
          {rows.map((row) => (
            <SlippingCard key={row.id} row={row} now={now} onTap={onTap} />
          ))}
        </div>
      )}
    </section>
  )
}
