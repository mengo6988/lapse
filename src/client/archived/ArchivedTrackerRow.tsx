/**
 * One archived Tracker: name, its last-done state per Variant (or one line
 * for a Tracker without Variants — the same flattening rule as the active
 * list, docs/spec.md § Domain rules, via the shared domain/trackerRows
 * flattener), "unarchive", and "delete". Unarchive reuses
 * src/client/tracker/useUpdateTracker.ts unchanged ({ archived: false }
 * already round-trips through PATCH /trackers/:id and the shared bootstrap
 * cache merge) rather than a bespoke hook. Delete only opens the
 * confirmation; ArchivedRoute owns the dialog itself, so at most one is ever
 * mounted for the whole screen.
 */
import { type MouseEvent, useState } from 'react'
import type { Tracker } from '../api'
import { trackerRows } from '../domain/trackerRows'
import { formatRowSubline } from '../list/formatListRow'
import { TrackerApiError } from '../tracker/mutationClient'
import { useUpdateTracker } from '../tracker/useUpdateTracker'

interface ArchivedTrackerRowProps {
  tracker: Tracker
  now: Date
  onRequestDelete: (openedFrom: HTMLElement) => void
}

export function ArchivedTrackerRow({ tracker, now, onRequestDelete }: ArchivedTrackerRowProps) {
  const [unarchiveError, setUnarchiveError] = useState<string | undefined>()
  const updateTracker = useUpdateTracker()

  const rows = trackerRows([tracker], now, { includeArchived: true, sortByUrgency: false })

  function handleUnarchive() {
    setUnarchiveError(undefined)
    updateTracker.mutate(
      { id: tracker.id, archived: false },
      { onError: (error) => setUnarchiveError(error instanceof TrackerApiError ? error.message : undefined) },
    )
  }

  function handleDeleteClick(event: MouseEvent<HTMLButtonElement>) {
    onRequestDelete(event.currentTarget)
  }

  return (
    <li className="archived-row">
      <div className="archived-row__body">
        <p className="archived-row__name">{tracker.name}</p>
        {rows.map((row) => (
          <p key={row.key} className="archived-row__sub">
            {row.variantName !== null ? `${row.variantName} · ` : ''}
            {formatRowSubline(row, now)}
          </p>
        ))}
        {unarchiveError && (
          <p className="archived-row__error" role="alert">
            {unarchiveError}
          </p>
        )}
      </div>
      <div className="archived-row__actions">
        <button
          type="button"
          className="archived-row__unarchive"
          onClick={handleUnarchive}
          disabled={updateTracker.isPending}
          aria-busy={updateTracker.isPending}
        >
          unarchive
        </button>
        <button type="button" className="archived-row__delete" onClick={handleDeleteClick}>
          delete
        </button>
      </div>
    </li>
  )
}
