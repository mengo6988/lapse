/**
 * One row in the entry history list (docs/design.md § Tracker detail /
 * history: "Entry list newest-first: relative + absolute time, duration,
 * note. Tap → edit sheet"). The whole row is a real `<button>` — no
 * gesture-only affordance — so opening the edit sheet needs no swipe, no
 * long-press, just a tap or Enter/Space via keyboard.
 */
import type { Entry } from '../api'
import { formatEntryAbsolute, formatEntryRelative } from './entryFormat'

export interface EntryRowProps {
  entry: Entry
  now: Date
  /** the Variant name (or a tracker-level label) to show, or null to omit it entirely — null for a Tracker with no Variants, where every Entry is implicitly tracker-level. */
  variantLabel: string | null
  onOpen: (entry: Entry, openedFrom: HTMLElement) => void
}

export function EntryRow({ entry, now, variantLabel, onOpen }: EntryRowProps) {
  const metaParts = [variantLabel, entry.durationMinutes !== null ? `${entry.durationMinutes}m` : null, entry.note].filter(
    (part): part is string => part !== null,
  )

  return (
    <li>
      <button type="button" className="detail-entry" onClick={(event) => onOpen(entry, event.currentTarget)}>
        <div className="detail-entry__top">
          <span className="detail-entry__relative">{formatEntryRelative(entry.occurredAt, now)}</span>
          <span className="detail-entry__absolute">{formatEntryAbsolute(entry.occurredAt)}</span>
        </div>
        {metaParts.length > 0 && <p className="detail-entry__meta">{metaParts.join(' · ')}</p>}
      </button>
    </li>
  )
}
