/**
 * Flattens Trackers into rows per docs/spec.md § Domain rules: a Tracker
 * with Variants contributes one row per Variant, never a tracker-level row
 * of its own; a Tracker without Variants is a single row. This is the one
 * owner of that rule — the List ledger, the Tracker detail screen and the
 * Archived view all call it, each choosing only the two things that
 * genuinely differ between them: whether archived Trackers are included,
 * and whether the result is sorted by urgency. Detail and Archived's
 * single-Tracker case is this same function over a one-element list.
 *
 * All Threshold, urgency and sort math is delegated to the sibling domain
 * modules — this module only reshapes data, it never recomputes a ratio or
 * a bucket order.
 */
import type { Tracker } from '../api'
import { effectiveThresholdDays } from './threshold'
import { sortByUrgency as sortRowsByUrgency } from './sort'
import { urgencyState, type UrgencyState } from './urgency'

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

export interface TrackerRowOptions {
  /** List excludes archived Trackers; Detail and Archived include them. */
  readonly includeArchived: boolean
  /** List sorts by urgency; Detail keeps declaration order; Archived is unsorted. */
  readonly sortByUrgency: boolean
}

export function trackerRows(
  trackers: readonly Tracker[],
  now: Date,
  options: TrackerRowOptions,
): ListRow[] {
  const includedTrackers = options.includeArchived
    ? trackers
    : trackers.filter((tracker) => tracker.archivedAt === null)
  const rows = includedTrackers.flatMap((tracker) => rowsForTracker(tracker, now))
  return options.sortByUrgency ? sortRowsByUrgency(rows, now) : rows
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
