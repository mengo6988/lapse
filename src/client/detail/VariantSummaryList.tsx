/**
 * Wires the shared domain/trackerRows flattener + buildVariantInsights to
 * VariantSummaryRow, and owns the one-tap accept: it writes the suggested
 * Threshold back to whichever entity actually owns the effective value
 * being evaluated — the Variant itself for a Variant row (even one
 * currently inheriting the parent's Threshold, since the suggestion is
 * Variant-specific data), or the Tracker for a tracker-level row (a
 * Tracker without Variants). docs/spec.md doesn't say which of the two a
 * suggestion's accept should target when Variants exist — this is the
 * interpretation this ticket settled on; see the ticket notes for the
 * reasoning.
 */
import type { Tracker, Entry } from '../api'
import { useUpdateTracker } from '../tracker/useUpdateTracker'
import { useUpdateVariant } from '../tracker/useUpdateVariant'
import { trackerRows, type ListRow } from '../domain/trackerRows'
import { buildVariantInsights } from './variantInsights'
import { VariantSummaryRow } from './VariantSummaryRow'

export interface VariantSummaryListProps {
  tracker: Tracker
  now: Date
  loadedEntries: readonly Entry[]
}

export function VariantSummaryList({ tracker, now, loadedEntries }: VariantSummaryListProps) {
  const rows = trackerRows([tracker], now, { includeArchived: true, sortByUrgency: false })
  const insights = buildVariantInsights(rows, loadedEntries)
  const insightByKey = new Map(insights.map((insight) => [insight.rowKey, insight]))

  const updateTracker = useUpdateTracker()
  const updateVariant = useUpdateVariant()
  const accepting = updateTracker.isPending || updateVariant.isPending

  function acceptSuggestion(row: ListRow, suggestedThresholdDays: number) {
    if (row.variantId !== null) {
      updateVariant.mutate({ variantId: row.variantId, thresholdDays: suggestedThresholdDays })
    } else {
      updateTracker.mutate({ id: tracker.id, thresholdDays: suggestedThresholdDays })
    }
  }

  return (
    <ul className="detail-summary">
      {rows.map((row) => (
        <VariantSummaryRow
          key={row.key}
          row={row}
          insight={insightByKey.get(row.key) ?? { rowKey: row.key, observedIntervalDays: null, suggestion: null }}
          now={now}
          onAcceptSuggestion={acceptSuggestion}
          accepting={accepting}
        />
      ))}
    </ul>
  )
}
