import { useEffect, useRef, useState } from 'react'
import { AllItemsFooter } from '../home/AllItemsFooter'
import { buildHomeRows, type HomeRow } from '../home/homeRows'
import '../home/home.css'
import { QuickLogSection } from '../home/QuickLogSection'
import { selectQuickLogRows } from '../home/selectQuickLogRows'
import { selectSlippingRows } from '../home/selectSlippingRows'
import { SlippingSection } from '../home/SlippingSection'
import { applyFrozenOrder } from '../log/applyFrozenOrder'
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
 * list, and the log toast. While a log's 5s undo window is open
 * (src/client/log/logWindowStore.ts), slipping/quick-log membership and
 * order come from that window's frozen snapshot instead of the live
 * selectors, so the just-tapped row stays pinned in its slot; on expiry the
 * store's resort token flips and this route fades back into the live order.
 */
export function HomeRoute() {
  const { data } = useBootstrapQuery()
  const now = new Date()
  const { logRow } = useLogRow()
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
    logRow({ trackerId: row.trackerId, variantId: row.variantId })
  }

  return (
    <section aria-label="home" className={`home${fading ? ' log-resort' : ''}`}>
      <SlippingSection rows={slippingRows} now={now} onTap={handleTap} justLoggedId={justLoggedId} />
      <QuickLogSection rows={quickLogRows} now={now} onTap={handleTap} justLoggedId={justLoggedId} />
      <AllItemsFooter count={rows.length} />
      <LogToast />
    </section>
  )
}
