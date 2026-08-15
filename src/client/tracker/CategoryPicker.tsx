/**
 * Category chips (docs/design.md § Create/Edit Tracker: "Category picker
 * (chips)"). Categories come from the bootstrap payload — this component
 * just renders whatever list it's given plus a "none" chip for clearing.
 */
import type { Category } from '../api'
import { FieldError } from './FieldError'

const ERROR_ID = 'tracker-category-error'

interface CategoryPickerProps {
  categories: readonly Category[]
  value: string | null
  onChange: (categoryId: string | null) => void
  error?: string
}

function chipClass(active: boolean): string {
  return active ? 'tracker-form__chip tracker-form__chip--active' : 'tracker-form__chip'
}

export function CategoryPicker({ categories, value, onChange, error }: CategoryPickerProps) {
  return (
    <div className="tracker-form__field">
      <div className="tracker-form__chips" role="group" aria-label="category" aria-describedby={ERROR_ID}>
        <button type="button" className={chipClass(value === null)} aria-pressed={value === null} onClick={() => onChange(null)}>
          none
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={chipClass(value === category.id)}
            aria-pressed={value === category.id}
            onClick={() => onChange(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <FieldError id={ERROR_ID} message={error} />
    </div>
  )
}
