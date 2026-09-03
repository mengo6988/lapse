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
 *
 * Also matches HardDeleteDialog's portal + inert-background pair: a focus
 * trap alone still leaves the categories list behind this dialog readable
 * and reachable by a screen reader's virtual cursor — see
 * src/client/outbox/QueuedSheet.tsx and useInertBackground.ts's doc comment
 * (.scratch/audit-fixes/spec.md decision 6).
 */
import { createPortal } from 'react-dom'
import { useInertBackground } from '../shell/useInertBackground'
import { useFocusTrap } from '../tracker/useFocusTrap'
import { TrackerApiError } from '../tracker/mutationClient'
import { useDeleteCategory } from './useDeleteCategory'

interface CategoryDeleteDialogProps {
  categoryId: string
  categoryName: string
  restoreFocusTo: HTMLElement | null
  onCancel: () => void
  onDeleted: () => void
  /** true while the caller plays the exit animation — see src/client/shell/useExitTransition.ts. */
  closing?: boolean
}

export function CategoryDeleteDialog({ categoryId, categoryName, restoreFocusTo, onCancel, onDeleted, closing = false }: CategoryDeleteDialogProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onCancel, restoreFocusTo)
  const deleteCategory = useDeleteCategory()
  // this dialog is only ever mounted (by CategoriesManager.tsx) for its full
  // open + exit-latch lifetime, so "mounted" already is "active" — see
  // src/client/shell/useInertBackground.ts.
  useInertBackground(true)

  function handleConfirm() {
    deleteCategory.mutate(categoryId, { onSuccess: onDeleted })
  }

  const deleteError = deleteCategory.error instanceof TrackerApiError ? deleteCategory.error.message : undefined

  // portaled to document.body so the dialog lands as a DOM sibling of
  // #app-root, not a descendant — see useInertBackground.ts's doc comment.
  return createPortal(
    <>
      <div className={closing ? 'tracker-sheet-scrim tracker-sheet-scrim--closing' : 'tracker-sheet-scrim'} onClick={onCancel} />
      <div
        className={closing ? 'confirm-dialog confirm-dialog--closing' : 'confirm-dialog'}
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
    </>,
    document.body,
  )
}
