/**
 * Per-Variant (or, for a Tracker without Variants, tracker-level) summary
 * rows for the detail screen. Reuses the exact `ListRow` shape from
 * src/client/list/buildListRows.ts so formatRowCount/formatRowSubline
 * (src/client/list/formatListRow.ts) work unmodified — detail doesn't get a
 * second formatter (that module is read-only from here per the ticket
 * fence; its `rowsForTracker` helper isn't exported, so this mirrors that
 * same shaping logic scoped to one Tracker).
 *
 * Unlike buildListRows, this never filters by `archivedAt` — an archived
 * Tracker's detail must still be viewable, only the home/list read model
 * hides archived rows — and it keeps Tracker/Variant declaration order
 * rather than urgency-sorting, since detail already groups everything
 * under one Tracker's own header.
 */
import type { Tracker } from '../api'
import { effectiveThresholdDays } from '../domain/threshold'
import { urgencyState } from '../domain/urgency'
import type { ListRow } from '../list/buildListRows'

export function buildDetailRows(tracker: Tracker, now: Date): ListRow[] {
  if (tracker.variants.length === 0) {
    return [trackerRow(tracker, now)]
  }
  return tracker.variants.map((variant) => variantRow(tracker, variant, now))
}

function trackerRow(tracker: Tracker, now: Date): ListRow {
  const thresholdDays = effectiveThresholdDays(tracker)
  const lastEntryAt = tracker.latestEntry?.occurredAt ?? null
  return {
    key: tracker.id,
    trackerId: tracker.id,
    variantId: null,
    name: tracker.name,
    variantName: null,
    categoryId: tracker.categoryId,
    thresholdDays,
    lastEntryAt,
    urgency: urgencyState(lastEntryAt, thresholdDays, now),
  }
}

function variantRow(tracker: Tracker, variant: Tracker['variants'][number], now: Date): ListRow {
  const thresholdDays = effectiveThresholdDays(tracker, variant)
  const lastEntryAt = variant.latestEntry?.occurredAt ?? null
  return {
    key: variant.id,
    trackerId: tracker.id,
    variantId: variant.id,
    name: tracker.name,
    variantName: variant.name,
    categoryId: tracker.categoryId,
    thresholdDays,
    lastEntryAt,
    urgency: urgencyState(lastEntryAt, thresholdDays, now),
  }
}
