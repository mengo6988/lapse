import { AllItemsFooter } from '../home/AllItemsFooter'
import { buildHomeRows } from '../home/homeRows'
import '../home/home.css'
import { QuickLogSection } from '../home/QuickLogSection'
import { selectQuickLogRows } from '../home/selectQuickLogRows'
import { selectSlippingRows } from '../home/selectSlippingRows'
import { SlippingSection } from '../home/SlippingSection'
import { useBootstrapQuery } from '../query/useBootstrap'

/**
 * home digest (docs/design.md § Home, build ticket 10): the top-3 slipping
 * rows, quick-log tiles, and a footer into the full list. Tap-to-log is
 * ticket 12's — SlippingCard/QuickLogTile already accept an optional
 * `onTap(row)` prop that this route doesn't pass, which is ticket 12's seam.
 * The header magnifier (Header.tsx) is the only thing that opens search —
 * this screen never renders a search input of its own.
 */
export function HomeRoute() {
  const { data } = useBootstrapQuery()
  const now = new Date()

  const rows = buildHomeRows(data?.trackers ?? [])
  const slippingRows = selectSlippingRows(rows, now)
  const slippingIds = new Set(slippingRows.map((row) => row.id))
  const quickLogRows = selectQuickLogRows(rows, slippingIds, now)

  return (
    <section aria-label="home" className="home">
      <SlippingSection rows={slippingRows} now={now} />
      <QuickLogSection rows={quickLogRows} now={now} />
      <AllItemsFooter count={rows.length} />
    </section>
  )
}
