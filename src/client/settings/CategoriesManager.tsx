/**
 * Categories manager (docs/design.md § Archived/Settings: "categories
 * manager"; docs/spec.md § Categories: add/rename/recolor/delete). Owns the
 * one delete confirmation that can be open at a time, mirroring
 * src/client/archived/ArchivedRoute.tsx's `deleteRequest` pattern — only one
 * Category is ever mid-delete for the whole screen.
 */
import { useState } from 'react'
import { useBootstrapQuery } from '../query/useBootstrap'
import { useExitTransition } from '../shell/useExitTransition'
import { AddCategoryForm } from './AddCategoryForm'
import { CategoryDeleteDialog } from './CategoryDeleteDialog'
import { CategoryRow } from './CategoryRow'

interface DeleteRequest {
  categoryId: string
  categoryName: string
  openedFrom: HTMLElement | null
}

export function CategoriesManager() {
  const { data } = useBootstrapQuery()
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  // the request clears instantly on cancel/confirm; the latch keeps the
  // dialog mounted through its exit fade — see useExitTransition.ts.
  const { value: deleteState, closing: deleteClosing } = useExitTransition(deleteRequest)
  const categories = data?.categories ?? []

  return (
    <div className="settings-categories">
      <ul className="settings-categories__list">
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onRequestDelete={(openedFrom) => setDeleteRequest({ categoryId: category.id, categoryName: category.name, openedFrom })}
          />
        ))}
      </ul>
      <AddCategoryForm />

      {deleteState && (
        <CategoryDeleteDialog
          categoryId={deleteState.categoryId}
          categoryName={deleteState.categoryName}
          restoreFocusTo={deleteState.openedFrom}
          onCancel={() => setDeleteRequest(null)}
          onDeleted={() => setDeleteRequest(null)}
          closing={deleteClosing}
        />
      )}
    </div>
  )
}
