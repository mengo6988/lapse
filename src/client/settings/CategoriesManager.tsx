/**
 * Categories manager (docs/design.md § Archived/Settings: "categories
 * manager"; docs/spec.md § Categories: add/rename/recolor/delete). Owns the
 * one delete confirmation that can be open at a time, mirroring
 * src/client/archived/ArchivedRoute.tsx's `deleteRequest` pattern — only one
 * Category is ever mid-delete for the whole screen.
 */
import { useState } from 'react'
import { useBootstrapQuery } from '../query/useBootstrap'
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

      {deleteRequest && (
        <CategoryDeleteDialog
          categoryId={deleteRequest.categoryId}
          categoryName={deleteRequest.categoryName}
          restoreFocusTo={deleteRequest.openedFrom}
          onCancel={() => setDeleteRequest(null)}
          onDeleted={() => setDeleteRequest(null)}
        />
      )}
    </div>
  )
}
