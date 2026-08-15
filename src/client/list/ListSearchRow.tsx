import { forwardRef } from 'react'

interface ListSearchRowProps {
  query: string
  onQueryChange: (query: string) => void
  onCancel: () => void
}

/**
 * the search input that replaces the category chips in place (docs/spec.md
 * § Features 11 — "on list it expands to an input in place", never an
 * overlay). label is visually hidden; the visible "search" placeholder
 * mirrors the interaction reference (12-home-prototype.html).
 */
export const ListSearchRow = forwardRef<HTMLInputElement, ListSearchRowProps>(function ListSearchRow(
  { query, onQueryChange, onCancel },
  ref,
) {
  return (
    <div className="list-search-row">
      <label htmlFor="list-search-input" className="list-search-row__label">
        search trackers
      </label>
      <input
        id="list-search-input"
        ref={ref}
        type="text"
        className="list-search-row__input"
        placeholder="search"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <button type="button" className="list-search-row__cancel" onClick={onCancel}>
        cancel
      </button>
    </div>
  )
})
