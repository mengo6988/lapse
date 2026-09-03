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
 *
 * `type="search"` (.scratch/audit-fixes/spec.md decision 8) over `type="text"`: iOS shows
 * the dedicated search keyboard and a native clear button, so clearing a
 * filter is one tap instead of a hold-backspace. The accessible role moves
 * from textbox to searchbox as a result — callers querying this input by
 * role need to follow.
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
        type="search"
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
