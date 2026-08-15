import { useCallback, useEffect, useRef, useState } from 'react'
import { CategoryChips } from '../list/CategoryChips'
import { ListSearchRow } from '../list/ListSearchRow'
import { ListRowItem } from '../list/ListRowItem'
import { buildListRows } from '../list/buildListRows'
import { filterListRows } from '../list/filterListRows'
import { useSearchOpenParam } from '../list/useSearchOpenParam'
import '../list/list.css'
import { useBootstrapQuery } from '../query/useBootstrap'

const EMPTY_LIST_MESSAGE = 'nothing here yet — add your first tracker'
const NO_MATCHES_MESSAGE = 'no matches'

/**
 * the full ledger (docs/design.md § List, frame 3b): every active row in
 * spec sort order, filterable by Category chip and searchable by name.
 * archived Trackers arrive from bootstrap with `archivedAt` set — filtering
 * them out is buildListRows's job, not this component's. tap-to-log lands
 * in ticket 12; rows here are read-only.
 */
export function ListRoute() {
  const { data } = useBootstrapQuery()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  useSearchOpenParam(openSearch)

  // focuses whenever search transitions closed -> open, whether that's the
  // initial arrival via ?search=open or a later re-click of the header
  // magnifier while already on this route.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  const now = new Date()
  const categories = data?.categories ?? []
  const allRows = buildListRows(data?.trackers ?? [], now)
  const visibleRows = filterListRows(allRows, { categoryId: selectedCategoryId, query })

  const isActivelySearching = searchOpen && query.trim() !== ''
  const emptyMessage = isActivelySearching ? NO_MATCHES_MESSAGE : EMPTY_LIST_MESSAGE

  return (
    <section aria-label="list" className="list-route">
      {searchOpen ? (
        <ListSearchRow
          ref={searchInputRef}
          query={query}
          onQueryChange={setQuery}
          onCancel={closeSearch}
        />
      ) : (
        <CategoryChips
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      )}

      {visibleRows.length === 0 ? (
        <p className="list-empty">{emptyMessage}</p>
      ) : (
        <ul className="list-rows">
          {visibleRows.map((row) => (
            <ListRowItem key={row.key} row={row} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}
