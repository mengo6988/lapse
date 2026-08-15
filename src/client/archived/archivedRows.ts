/**
 * Last-done rows for one archived Tracker (docs/spec.md § Archive: "hides
 * from home, keeps history"). Reuses the same per-Variant flattening rule as
 * the active list — a Tracker without Variants is one row, a Tracker with
 * Variants is one row per Variant, never a separate tracker-level row
 * alongside them (docs/spec.md § Domain rules) — and the same `ListRow`
 * shape, so src/client/list/formatListRow.ts's formatter works unchanged.
 *
 * This necessarily duplicates the row-shaping half of
 * src/client/list/buildListRows.ts (trackerRow/variantRow aren't exported,
 * and that module's own `buildListRows` hard-filters archived Trackers out
 * before this ticket's file fence could ever reach it to export them). It
 * deliberately skips that module's other two rules: the archived filter
 * (the caller already selected only archived Trackers) and the urgency sort
 * (an archived row is inert, not ranked by how overdue it once was).
 */
import { effectiveThresholdDays } from '../domain/threshold'
import { urgencyState } from '../domain/urgency'
import type { Tracker } from '../api/types'
import type { ListRow } from '../list/buildListRows'

export function archivedRowsForTracker(tracker: Tracker, now: Date): ListRow[] {
  if (tracker.variants.length === 0) return [trackerRow(tracker, now)]
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
