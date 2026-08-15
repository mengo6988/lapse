import { useEffect, useRef, useState } from 'react'
import { AllItemsFooter } from '../home/AllItemsFooter'
import { buildHomeRows, type HomeRow } from '../home/homeRows'
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

const homeRowId = (row: HomeRow) => row.id

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
 */
export function HomeRoute() {
  const { data } = useBootstrapQuery()
  const now = new Date()
  const { logEntry } = useLogRow()
  const windowState = useLogWindowState()
  const resortToken = useResortToken()

  const rows = buildHomeRows(data?.trackers ?? [])
  const isFrozen = windowState.kind === 'open'

  const slippingRows = isFrozen
    ? applyFrozenOrder(rows, windowState.freeze.slippingIds, homeRowId)
    : selectSlippingRows(rows, now)
  const slippingIds = new Set(slippingRows.map((row) => row.id))
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

  function handleTap(row: HomeRow) {
    logEntry({ trackerId: row.trackerId, variantId: row.variantId })
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
