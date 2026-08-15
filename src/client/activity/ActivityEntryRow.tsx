/**
 * One row in the cross-Tracker activity feed (build ticket 21 acceptance
 * criterion: "each showing its Tracker (and Variant when present), a
 * relative time, and duration or note when present" — the relative half of
 * that is stated once by the day heading above the row rather than repeated
 * on every row under it, so the row carries the clock time; see
 * src/client/activity/activityFormat.ts). The whole row is a
 * real `<button>` — no gesture-only affordance, matching
 * src/client/detail/EntryRow.tsx and src/client/list/ListRowItem.tsx's same
 * stance — so reaching the place this Entry can be edited or deleted needs
 * no swipe or long-press, just a tap or Enter/Space via keyboard. Tapping
 * navigates to `/tracker/:trackerId` (ActivityRoute.tsx) rather than
 * opening a second edit sheet here — that surface already exists (build
 * ticket 15).
 */
import { formatEntryMeta, formatEntryTime } from './activityFormat'
import type { ActivityRow } from './activityRows'

export interface ActivityEntryRowProps {
  row: ActivityRow
  onOpen: (row: ActivityRow) => void
}

export function ActivityEntryRow({ row, onOpen }: ActivityEntryRowProps) {
  const meta = formatEntryMeta(row.durationMinutes, row.note)

  return (
    <li>
      <button type="button" className="activity-entry" onClick={() => onOpen(row)}>
        <span className="activity-entry__body">
          <span className="activity-entry__name">
            {row.trackerName}
            {row.variantName !== null && <span className="activity-entry__variant"> · {row.variantName}</span>}
          </span>
          {meta !== null && <span className="activity-entry__meta">{meta}</span>}
        </span>
        <span className="activity-entry__time">{formatEntryTime(row.occurredAt)}</span>
      </button>
    </li>
  )
}
