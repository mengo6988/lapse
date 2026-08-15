/**
 * One per-Variant (or, for a Tracker without Variants, tracker-level)
 * summary row (docs/spec.md § Features 5, 9, 10 — "per-Variant summaries
 * with their effective Thresholds and last-done state", the observed-
 * interval line, and the Threshold suggestion hint with one-tap accept).
 * Last-done formatting is imported from src/client/list/formatListRow.ts
 * rather than re-implemented — this component only adds the two lines that
 * are specific to detail: observed interval and the suggestion hint.
 */
import { formatRowCount, formatRowSubline } from '../list/formatListRow'
import type { ListRow } from '../domain/trackerRows'
import type { VariantInsight } from './variantInsights'

export interface VariantSummaryRowProps {
  row: ListRow
  insight: VariantInsight
  now: Date
  onAcceptSuggestion: (row: ListRow, suggestedThresholdDays: number) => void
  accepting?: boolean
}

function suggestionText(insight: VariantInsight): string | null {
  if (insight.suggestion === null) return null
  const rounded = Math.round(insight.suggestion.observedIntervalDays)
  return insight.suggestion.kind === 'set'
    ? `actually every ~${rounded}d — set threshold?`
    : `actually every ~${rounded}d — update threshold?`
}

export function VariantSummaryRow({ row, insight, now, onAcceptSuggestion, accepting }: VariantSummaryRowProps) {
  const displayName = row.variantName ?? row.name
  const suggestionCopy = suggestionText(insight)

  return (
    <li className="detail-summary__row">
      <div className="detail-summary__top">
        <p className="detail-summary__name">{displayName}</p>
        <span className="detail-summary__count">{formatRowCount(row, now)}</span>
      </div>
      <p className="detail-summary__sub">{formatRowSubline(row, now)}</p>

      {insight.observedIntervalDays !== null && (
        <p className="detail-summary__observed">actually every ~{Math.round(insight.observedIntervalDays)}d</p>
      )}

      {insight.suggestion !== null && suggestionCopy !== null && (
        <div className="detail-suggestion">
          <p className="detail-suggestion__text">{suggestionCopy}</p>
          <button
            type="button"
            className="detail-suggestion__accept"
            onClick={() => onAcceptSuggestion(row, Math.round(insight.suggestion!.observedIntervalDays))}
            disabled={accepting}
            aria-busy={accepting}
          >
            accept
          </button>
        </div>
      )}
    </li>
  )
}
