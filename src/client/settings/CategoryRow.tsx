/**
 * One row in the categories manager (docs/spec.md § Categories: rename,
 * recolor, delete). Rename commits on blur — the same "no per-keystroke
 * write" idiom as src/client/tracker/VariantRow.tsx's name field — while
 * recolor commits on the picker's own confirm gesture, so neither field
 * writes per keystroke or per pointer move. `useUpdateCategory` is shared by
 * both fields since a rename and a recolor are never in flight from the same
 * row at once.
 */
import { type ChangeEvent, type FocusEvent, type MouseEvent, useEffect, useState } from 'react'
import type { Category } from '../api'
import { FieldError } from '../tracker/FieldError'
import { TrackerApiError } from '../tracker/mutationClient'
import { normalizeColor } from './color'
import { useUpdateCategory } from './useUpdateCategory'

interface CategoryRowProps {
  category: Category
  onRequestDelete: (openedFrom: HTMLElement) => void
}

export function CategoryRow({ category, onRequestDelete }: CategoryRowProps) {
  const [draftName, setDraftName] = useState(category.name)
  // resync if the persisted name changes from outside (e.g. a server echo).
  useEffect(() => setDraftName(category.name), [category.name])

  const [draftColor, setDraftColor] = useState(category.color)
  useEffect(() => setDraftColor(category.color), [category.color])

  const updateCategory = useUpdateCategory()

  const fieldErrors = updateCategory.error instanceof TrackerApiError ? updateCategory.error.fieldErrors : {}
  const formError =
    updateCategory.error instanceof TrackerApiError && Object.keys(fieldErrors).length === 0
      ? updateCategory.error.message
      : undefined
  const errorMessage = fieldErrors.name ?? fieldErrors.color ?? formError

  function commitName(event: FocusEvent<HTMLInputElement>) {
    const trimmed = event.target.value.trim()
    if (trimmed === '' || trimmed === category.name) {
      setDraftName(category.name) // revert a blank or unchanged edit rather than sending a no-op write
      return
    }
    updateCategory.mutate({ id: category.id, name: trimmed })
  }

  /**
   * React routes both the `input` and the `change` DOM events to `onChange`
   * for a colour input, and a native picker fires `input` continuously while
   * the user drags through the gradient — committing on those would PATCH
   * once per pointer move. Only `change`, which the picker fires when the
   * pick is confirmed, is a real edit; everything before it just moves the
   * swatch so the user can see what they're picking.
   */
  function handleColorEvent(event: ChangeEvent<HTMLInputElement>) {
    const color = normalizeColor(event.target.value)
    setDraftColor(color)
    if (event.nativeEvent.type !== 'change') return
    if (color === category.color) return // picker dismissed on the colour it opened with
    updateCategory.mutate({ id: category.id, color })
  }

  function handleDeleteClick(event: MouseEvent<HTMLButtonElement>) {
    onRequestDelete(event.currentTarget)
  }

  const errorId = `settings-category-${category.id}-error`

  return (
    <li className="settings-category-row">
      <input
        type="color"
        className="settings-category-row__swatch"
        aria-label={`${category.name} color`}
        value={draftColor}
        onChange={handleColorEvent}
      />
      <input
        type="text"
        className="settings-category-row__name"
        aria-label={`${category.name} name`}
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={commitName}
        aria-describedby={errorId}
        aria-invalid={errorMessage ? true : undefined}
      />
      <button type="button" className="settings-category-row__delete" onClick={handleDeleteClick} aria-label={`delete ${category.name}`}>
        delete
      </button>
      <FieldError id={errorId} message={errorMessage} />
    </li>
  )
}
