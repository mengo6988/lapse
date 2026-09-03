import { useEffect, useRef, useState } from 'react'
import type { ListRow } from '../domain/trackerRows'
import { trackerRows } from '../domain/trackerRows'
import { AllItemsFooter } from '../home/AllItemsFooter'
import '../home/home.css'
import { QuickLogSection } from '../home/QuickLogSection'
import { selectQuickLogRows } from '../home/selectQuickLogRows'
import { selectSlippingRows } from '../home/selectSlippingRows'
import { SlippingSection } from '../home/SlippingSection'
import { applyFrozenOrder } from '../log/applyFrozenOrder'
import { LogSheetHost } from '../log/LogSheetHost'
import { LogToast } from '../log/LogToast'
import '../log/log.css'
import { useLogRow } from '../log/useLogRow'
import { useLogWindowState, useResortToken } from '../log/logWindowStore'
import { useBootstrapQuery } from '../query/useBootstrap'

// mirrors --duration-fade (200ms); prefers-reduced-motion collapses the
// visible animation via src/client/styles/base.css, this is only how long
// the class stays applied to let the (collapsed-or-not) animation finish.
const RESORT_FADE_MS = 220

// shared with ListRoute.tsx (.scratch/audit-fixes/spec.md decision 5) — both screens read
// the same bootstrap query and disagree about it for no reason.
const FAILED_MESSAGE = "couldn't load trackers — try again"

const homeRowId = (row: ListRow) => row.key

/**
 * home digest (docs/design.md § Home, build ticket 10 + tap-to-log ticket
 * 12): the top-3 slipping rows, quick-log tiles, a footer into the full
 * list, the log toast, and the long-press log sheet host (build ticket 13).
 * While a log's 5s undo window is open (src/client/log/logWindowStore.ts),
 * slipping/quick-log membership and order come from that window's frozen
 * snapshot instead of the live selectors, so the just-tapped row stays
 * pinned in its slot; on expiry the store's resort token flips and this
 * route fades back into the live order.
 *
 * <LogSheetHost/> is mounted here (and again in ListRoute.tsx) rather than
 * once in AppShell, matching <LogToast/>'s own precedent — both read the
 * one shared module store, so a long-press's sheet stays open across
 * navigation exactly like the undo toast does. SlippingCard and
 * QuickLogTile open it directly on long-press (src/client/log/
 * logSheetStore.ts), so this route doesn't wire a callback for it.
 *
 * loading/failed/empty (.scratch/audit-fixes/spec.md decision 5): the digest below only
 * ever renders once the bootstrap query has data, cache-restored or fresh —
 * a persisted-cache hit skips straight past `pending`. Without that guard,
 * `data?.trackers ?? []` reads as zero Trackers during the pending window
 * and after an outright failure alike, so "nothing slipping" would lie
 * about both. A failed *background* refetch is not this guard's concern:
 * `data` is still set from the prior fetch, so the digest keeps rendering
 * it and the failed copy never appears over data that's still good.
 */
export function HomeRoute() {
  const { data, status } = useBootstrapQuery()
  const now = new Date()
  const { logEntry } = useLogRow()
  const windowState = useLogWindowState()
  const resortToken = useResortToken()

  const rows = trackerRows(data?.trackers ?? [], now, { includeArchived: false, sortByUrgency: false })
  const isFrozen = windowState.kind === 'open'

  const slippingRows = isFrozen
    ? applyFrozenOrder(rows, windowState.freeze.slippingIds, homeRowId)
    : selectSlippingRows(rows, now)
  const slippingIds = new Set(slippingRows.map((row) => row.key))
  const quickLogRows = isFrozen
    ? applyFrozenOrder(rows, windowState.freeze.quickLogIds, homeRowId)
    : selectQuickLogRows(rows, slippingIds, now)
  const justLoggedId = isFrozen ? windowState.rowId : null

  const [fading, setFading] = useState(false)
  const prevResortToken = useRef(resortToken)
  useEffect(() => {
    if (resortToken === prevResortToken.current) return
    prevResortToken.current = resortToken
    setFading(true)
    const timer = setTimeout(() => setFading(false), RESORT_FADE_MS)
    return () => clearTimeout(timer)
  }, [resortToken])

  function handleTap(row: ListRow) {
    logEntry({ trackerId: row.trackerId, variantId: row.variantId })
  }

  if (!data) {
    return (
      <section aria-label="home" className="home">
        {status === 'pending' && <p className="home__loading">loading…</p>}
        {status === 'error' && <p className="home__error">{FAILED_MESSAGE}</p>}
      </section>
    )
  }

  return (
    <section aria-label="home" className={`home${fading ? ' log-resort' : ''}`}>
      <SlippingSection rows={slippingRows} now={now} onTap={handleTap} justLoggedId={justLoggedId} />
      <QuickLogSection rows={quickLogRows} now={now} onTap={handleTap} justLoggedId={justLoggedId} />
      <AllItemsFooter count={rows.length} />
      <LogToast />
      <LogSheetHost />
    </section>
  )
}
