import type { Category } from '../api'

interface CategoryChipsProps {
  categories: readonly Category[]
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
}

/**
 * pill filter row per docs/design.md § Shape & components — "all" plus one
 * chip per Category. `aria-pressed` gives the selection a non-visual signal
 * alongside the lavender fill (never colour as the sole signal).
 */
export function CategoryChips({ categories, selectedCategoryId, onSelect }: CategoryChipsProps) {
  return (
    <div className="list-chips" role="group" aria-label="filter by category">
      <button
        type="button"
        className="list-chip"
        aria-pressed={selectedCategoryId === null}
        onClick={() => onSelect(null)}
      >
        all
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className="list-chip"
          aria-pressed={selectedCategoryId === cat.id}
          onClick={() => onSelect(cat.id)}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}
