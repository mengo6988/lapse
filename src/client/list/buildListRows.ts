/**
 * flattens bootstrap Trackers into list rows per docs/spec.md § Domain
 * rules: a Tracker with Variants contributes one row per Variant (never a
 * separate tracker-level row); a Tracker without Variants is a single row.
 * archived Trackers are dropped here — the server includes them with
 * `archivedAt` set precisely so the client can filter them, and the list is
 * where that filtering happens (soft-deleted Variants are already excluded
 * server-side, so no equivalent filter is needed for those).
 *
 * all urgency/threshold/sort math is delegated to src/client/domain — this
 * module only reshapes data, it never recomputes a ratio or a bucket order.
 */
import { effectiveThresholdDays } from '../domain/threshold'
import { sortByUrgency } from '../domain/sort'
import { urgencyState, type UrgencyState } from '../domain/urgency'
import type { Tracker } from '../api/types'

export interface ListRow {
  readonly key: string
  readonly trackerId: string
  readonly variantId: string | null
  readonly name: string
  readonly variantName: string | null
  readonly categoryId: string | null
  readonly thresholdDays: number | null
  readonly lastEntryAt: string | null
  readonly urgency: UrgencyState
}

export function buildListRows(trackers: readonly Tracker[], now: Date): ListRow[] {
  const activeTrackers = trackers.filter((tracker) => tracker.archivedAt === null)
  const rows = activeTrackers.flatMap((tracker) => rowsForTracker(tracker, now))
  return sortByUrgency(rows, now)
}

function rowsForTracker(tracker: Tracker, now: Date): ListRow[] {
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
