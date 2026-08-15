/**
 * New Category form (docs/spec.md § Categories: "User can add"). A single
 * inline row rather than a modal — adding is the cheap, reversible end of
 * this screen, the same "cheapest possible flow" bias docs/design.md gives
 * Create Tracker's name field.
 */
import { useState, type FormEvent } from 'react'
import { FieldError } from '../tracker/FieldError'
import { TrackerApiError } from '../tracker/mutationClient'
import { normalizeColor } from './color'
import { useCreateCategory } from './useCreateCategory'

// lavender — the palette's primary accent (docs/design.md § Palette), used
// as a neutral starting swatch rather than defaulting to one of the four
// seeded Category colors.
const DEFAULT_COLOR = '#b4befe'
const NAME_ERROR_ID = 'settings-add-category-name-error'

export function AddCategoryForm() {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const createCategory = useCreateCategory()

  const fieldErrors = createCategory.error instanceof TrackerApiError ? createCategory.error.fieldErrors : {}
  const formError =
    createCategory.error instanceof TrackerApiError && Object.keys(fieldErrors).length === 0
      ? createCategory.error.message
      : undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    createCategory.mutate({ name: trimmed, color: normalizeColor(color) }, { onSuccess: () => setName('') })
  }

  return (
    <form className="settings-add-category" onSubmit={handleSubmit}>
      <input
        type="color"
        className="settings-add-category__swatch"
        aria-label="new category color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
      />
      <input
        type="text"
        className="settings-add-category__name"
        aria-label="new category name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-describedby={NAME_ERROR_ID}
        aria-invalid={fieldErrors.name ? true : undefined}
      />
      <button type="submit" className="settings-add-category__submit" disabled={createCategory.isPending} aria-busy={createCategory.isPending}>
        add
      </button>
      <FieldError id={NAME_ERROR_ID} message={fieldErrors.name ?? formError} />
    </form>
  )
}
