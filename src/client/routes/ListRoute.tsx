import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryChips } from '../list/CategoryChips'
import { ListSearchRow } from '../list/ListSearchRow'
import { ListRowItem } from '../list/ListRowItem'
import { trackerRows, type ListRow } from '../domain/trackerRows'
import { filterListRows } from '../list/filterListRows'
import { useSearchOpenParam } from '../list/useSearchOpenParam'
import '../list/list.css'
import { applyFrozenOrder } from '../log/applyFrozenOrder'
import { LogSheetHost } from '../log/LogSheetHost'
import { LogToast } from '../log/LogToast'
import '../log/log.css'
import { useLogRow } from '../log/useLogRow'
import { useLogWindowState, useResortToken } from '../log/logWindowStore'
import { useBootstrapQuery } from '../query/useBootstrap'

const EMPTY_LIST_MESSAGE = 'nothing here yet — add your first tracker'
const NO_MATCHES_MESSAGE = 'no matches'
// shared with HomeRoute.tsx (.scratch/audit-fixes/spec.md decision 5) — both screens read
// the same bootstrap query and disagree about it for no reason.
const FAILED_MESSAGE = "couldn't load trackers — try again"
// mirrors --duration-fade (200ms); prefers-reduced-motion collapses the
// visible animation via src/client/styles/base.css, this is only how long
// the class stays applied to let the (collapsed-or-not) animation finish.
const RESORT_FADE_MS = 220

const listRowId = (row: ListRow) => row.key

/**
 * the full ledger (docs/design.md § List, frame 3b): every active row in
 * spec sort order, filterable by Category chip and searchable by name, plus
 * tap-to-log (build ticket 12) and the long-press log sheet host (build
 * ticket 13). While a log's 5s undo window is open (src/client/log/
 * logWindowStore.ts), the row order comes from that window's frozen
 * snapshot instead of a fresh sort, applied *before* category/search
 * filtering — a just-logged row stays in its slot even if it's mid-filter.
 * On expiry the store's resort token flips and the list fades back into its
 * live sorted order.
 *
 * <LogSheetHost/> is mounted here (and again in HomeRoute.tsx), matching
 * <LogToast/>'s own precedent — ListRowItem opens it directly on long-press
 * (src/client/log/logSheetStore.ts), so this route doesn't wire a callback
 * for it.
 *
 * loading/failed/empty (.scratch/audit-fixes/spec.md decision 5): the chips/search row and
 * the row list only ever render once the bootstrap query has data — see
 * HomeRoute.tsx's twin of this guard for why `data?.trackers ?? []` alone
 * can't tell "nothing here yet" apart from "hasn't loaded" or "failed to
 * load". A failed background refetch leaves `data` set from the prior
 * fetch, so the ledger keeps rendering it instead of falling back here.
 */
export function ListRoute() {
  const { data, status } = useBootstrapQuery()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { logEntry } = useLogRow()
  const windowState = useLogWindowState()
  const resortToken = useResortToken()

  const openSearch = useCallback(() => setSearchOpen(true), [])
  useSearchOpenParam(openSearch)

  // focuses whenever search transitions closed -> open, whether that's the
  // initial arrival via ?search=open or a later re-click of the header
  // magnifier while already on this route.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const [fading, setFading] = useState(false)
  const prevResortToken = useRef(resortToken)
  useEffect(() => {
    if (resortToken === prevResortToken.current) return
    prevResortToken.current = resortToken
    setFading(true)
    const timer = setTimeout(() => setFading(false), RESORT_FADE_MS)
    return () => clearTimeout(timer)
  }, [resortToken])

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  function handleTap(row: ListRow) {
    logEntry({ trackerId: row.trackerId, variantId: row.variantId })
  }

  // swiping a row left reveals "details" (docs/design.md § List) — the only
  // route into the detail screen, since tap and long-press both log.
  function handleOpenDetail(row: ListRow) {
    navigate(`/tracker/${row.trackerId}`)
  }

  const now = new Date()
  const categories = data?.categories ?? []
  const liveRows = trackerRows(data?.trackers ?? [], now, { includeArchived: false, sortByUrgency: true })
  const isFrozen = windowState.kind === 'open'
  const orderedRows = isFrozen ? applyFrozenOrder(liveRows, windowState.freeze.listOrder, listRowId) : liveRows
  const visibleRows = filterListRows(orderedRows, { categoryId: selectedCategoryId, query })
  const justLoggedId = isFrozen ? windowState.rowId : null

  const isActivelySearching = searchOpen && query.trim() !== ''
  const emptyMessage = isActivelySearching ? NO_MATCHES_MESSAGE : EMPTY_LIST_MESSAGE

  if (!data) {
    return (
      <section aria-label="list" className="list-route">
        {status === 'pending' && <p className="list-route__loading">loading…</p>}
        {status === 'error' && <p className="list-route__error">{FAILED_MESSAGE}</p>}
      </section>
    )
  }

  return (
    <section aria-label="list" className={`list-route${fading ? ' log-resort' : ''}`}>
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
            <ListRowItem
              key={row.key}
              row={row}
              now={now}
              onTap={handleTap}
              onOpenDetail={handleOpenDetail}
              justLogged={row.key === justLoggedId}
            />
          ))}
        </ul>
      )}
      <LogToast />
      <LogSheetHost />
    </section>
  )
}
