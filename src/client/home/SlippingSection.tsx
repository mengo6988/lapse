import type { ListRow } from '../domain/trackerRows'
import { SlippingCard } from './SlippingCard'

interface SlippingSectionProps {
  readonly rows: readonly ListRow[]
  readonly now: Date
  readonly onTap?: (row: ListRow) => void
  /** build ticket 12: ListRow.key of the row currently in its 5s undo window, if any. */
  readonly justLoggedId?: string | null
}

/**
 * "slipping" section (docs/design.md § Home): the top overdue/due-soon rows
 * as accent-bar cards, or the "nothing slipping" empty state (build ticket
 * 10 acceptance criterion) when there are none.
 */
export function SlippingSection({ rows, now, onTap, justLoggedId = null }: SlippingSectionProps) {
  return (
    <section aria-label="slipping" className="slipping">
      <p className="slipping__label">slipping</p>
      {rows.length === 0 ? (
        <p className="slipping__empty">nothing slipping</p>
      ) : (
        <div className="slipping__cards">
          {rows.map((row) => (
            <SlippingCard
              key={row.key}
              row={row}
              now={now}
              onTap={onTap}
              justLogged={row.key === justLoggedId}
            />
          ))}
        </div>
      )}
    </section>
  )
}
