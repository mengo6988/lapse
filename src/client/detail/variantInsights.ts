/**
 * Per-row observed interval + Threshold suggestion (docs/spec.md § Features
 * 9, 10), reusing src/client/domain/interval.ts and suggestion.ts directly
 * rather than reimplementing either rule. Computed from whichever Entries
 * the detail screen's cursor-paginated history query has loaded so far,
 * filtered to that row's own `variantId` — a tracker-level Entry
 * (`variantId: null`) must never count toward a Variant's own observed
 * interval, mirroring the same exclusion docs/spec.md's domain rules apply
 * to a Variant's last-done state.
 */
import type { Entry } from '../api'
import { observedIntervalDays } from '../domain/interval'
import { suggestThreshold, type ThresholdSuggestion } from '../domain/suggestion'
import type { ListRow } from '../list/buildListRows'

export interface VariantInsight {
  readonly rowKey: string
  readonly observedIntervalDays: number | null
  readonly suggestion: ThresholdSuggestion
}

export function buildVariantInsights(rows: readonly ListRow[], loadedEntries: readonly Entry[]): VariantInsight[] {
  return rows.map((row) => {
    const timestamps = loadedEntries
      .filter((entry) => entry.variantId === row.variantId)
      .map((entry) => entry.occurredAt)

    return {
      rowKey: row.key,
      observedIntervalDays: observedIntervalDays(timestamps),
      suggestion: suggestThreshold(row.thresholdDays, timestamps),
    }
  })
}
