/**
 * Category delete confirmation — same modal shape as
 * src/client/archived/HardDeleteDialog.tsx (focus trap, Escape-to-cancel,
 * "cancel" gets the initial focus — this ticket's file fence permits
 * importing src/client/tracker/useFocusTrap.ts), but a softer message:
 * deleting a Category doesn't touch its Trackers. The server sets
 * `categoryId` null on every Tracker that referenced it (`on delete set
 * null`, src/server/routes/categories.ts) rather than removing them, so the
 * copy says exactly that instead of naming a count of things being
 * destroyed, per build ticket 22's acceptance criteria. Unlike hard-delete,
 * there's no async count to wait on — the Category itself is already known,
 * so the confirm action is enabled immediately.
 */
import { useFocusTrap } from '../tracker/useFocusTrap'
import { TrackerApiError } from '../tracker/mutationClient'
import { useDeleteCategory } from './useDeleteCategory'

interface CategoryDeleteDialogProps {
  categoryId: string
  categoryName: string
  restoreFocusTo: HTMLElement | null
  onCancel: () => void
  onDeleted: () => void
}

export function CategoryDeleteDialog({ categoryId, categoryName, restoreFocusTo, onCancel, onDeleted }: CategoryDeleteDialogProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onCancel, restoreFocusTo)
  const deleteCategory = useDeleteCategory()

  function handleConfirm() {
    deleteCategory.mutate(categoryId, { onSuccess: onDeleted })
  }

  const deleteError = deleteCategory.error instanceof TrackerApiError ? deleteCategory.error.message : undefined

  return (
    <>
      <div className="settings-dialog-scrim" onClick={onCancel} />
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`delete ${categoryName}`}
        ref={containerRef}
        tabIndex={-1}
      >
        <p className="settings-dialog__copy">
          delete "{categoryName}"? its trackers become uncategorised — they aren't touched.
        </p>

        {deleteError && (
          <p className="settings-dialog__error" role="alert">
            {deleteError}
          </p>
        )}

        <div className="settings-dialog__actions">
          <button type="button" className="settings-dialog__cancel" onClick={onCancel} disabled={deleteCategory.isPending}>
            cancel
          </button>
          <button
            type="button"
            className="settings-dialog__confirm"
            onClick={handleConfirm}
            disabled={deleteCategory.isPending}
            aria-busy={deleteCategory.isPending}
          >
            delete
          </button>
        </div>
      </div>
    </>
  )
}
