/**
 * Hard-delete confirmation (docs/design.md § Archived/Settings: "confirm
 * names the entry count being destroyed"). Unlike ArchiveSection's inline
 * two-tap confirm — archiving is reversible — this is a proper modal dialog:
 * destructive and irreversible, so it gets a focus trap and Escape-to-cancel
 * (reusing src/client/tracker/useFocusTrap.ts, this ticket's file fence
 * permits importing from src/client/tracker) rather than an inline expand.
 * "cancel" is the first focusable element in the dialog, so useFocusTrap's
 * open-focus behaviour lands on it, not on the destructive action.
 */
import { useFocusTrap } from '../tracker/useFocusTrap'
import { TrackerApiError } from '../tracker/mutationClient'
import { useEntryCountQuery } from './useEntryCount'
import { useHardDeleteTracker } from './useHardDeleteTracker'

interface HardDeleteDialogProps {
  trackerId: string
  trackerName: string
  restoreFocusTo: HTMLElement | null
  onCancel: () => void
  onDeleted: () => void
}

function entryCountLabel(count: number): string {
  if (count === 0) return 'no entries'
  if (count === 1) return '1 entry'
  return `${count} entries`
}

export function HardDeleteDialog({ trackerId, trackerName, restoreFocusTo, onCancel, onDeleted }: HardDeleteDialogProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onCancel, restoreFocusTo)
  const countQuery = useEntryCountQuery(trackerId, true)
  const hardDelete = useHardDeleteTracker()

  function handleConfirm() {
    hardDelete.mutate(trackerId, { onSuccess: onDeleted })
  }

  const deleteError = hardDelete.error instanceof TrackerApiError ? hardDelete.error.message : undefined

  return (
    <>
      <div className="archived-dialog-scrim" onClick={onCancel} />
      <div
        className="archived-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`delete ${trackerName}`}
        ref={containerRef}
        tabIndex={-1}
      >
        {countQuery.isPending && <p className="archived-dialog__status">checking entry count…</p>}

        {countQuery.isError && (
          <>
            <p className="archived-dialog__status archived-dialog__status--error" role="alert">
              couldn't check entry count — try again
            </p>
            <button type="button" className="archived-dialog__retry" onClick={() => countQuery.refetch()}>
              retry
            </button>
          </>
        )}

        {countQuery.isSuccess && (
          <p className="archived-dialog__copy">
            delete "{trackerName}"? destroys {entryCountLabel(countQuery.data)} — can't be undone.
          </p>
        )}

        {deleteError && (
          <p className="archived-dialog__error" role="alert">
            {deleteError}
          </p>
        )}

        <div className="archived-dialog__actions">
          <button type="button" className="archived-dialog__cancel" onClick={onCancel} disabled={hardDelete.isPending}>
            cancel
          </button>
          <button
            type="button"
            className="archived-dialog__confirm"
            onClick={handleConfirm}
            disabled={!countQuery.isSuccess || hardDelete.isPending}
            aria-busy={hardDelete.isPending}
          >
            delete forever
          </button>
        </div>
      </div>
    </>
  )
}
