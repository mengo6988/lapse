/**
 * category chip + search filters for the list, per docs/spec.md § Sorting
 * ("Category chips filter the list; sort order unchanged within the
 * filter") and § Features 11 (search over Tracker/Variant names). both
 * filters are `.filter()` passes over an already-sorted row array, never a
 * re-sort — the caller (domain/trackerRows) owns ordering.
 */
import type { ListRow } from '../domain/trackerRows'

export interface ListFilter {
  readonly categoryId: string | null
  readonly query: string
}

export function filterListRows(rows: readonly ListRow[], filter: ListFilter): ListRow[] {
  const byCategory =
    filter.categoryId === null ? rows : rows.filter((row) => row.categoryId === filter.categoryId)

  const trimmedQuery = filter.query.trim().toLowerCase()
  if (trimmedQuery === '') return [...byCategory]

  return byCategory.filter((row) => rowSearchText(row).includes(trimmedQuery))
}

function rowSearchText(row: ListRow): string {
  const parts = row.variantName === null ? [row.name] : [row.name, row.variantName]
  return parts.join(' ').toLowerCase()
}
