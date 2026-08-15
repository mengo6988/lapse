import type { Tracker } from '../api'
import { effectiveThresholdDays } from '../domain/threshold'

/** the row shape Home (and structurally, List) render — see buildHomeRows. */
export interface HomeRow {
  readonly id: string
  readonly trackerId: string
  readonly variantId: string | null
  readonly name: string
  readonly variantLabel: string | null
  readonly thresholdDays: number | null
  readonly lastEntryAt: string | null
}

/**
 * flattens bootstrap Trackers into rows per docs/spec.md § Domain rules: a
 * Tracker with Variants contributes one row per Variant and no row of its
 * own; a Tracker without Variants is one row. Archived Trackers are
 * excluded — bootstrap ships them with the flag set for the archived view
 * (not built yet), but they never belong on the home digest.
 */
export function buildHomeRows(trackers: readonly Tracker[]): HomeRow[] {
  return trackers
    .filter((tracker) => tracker.archivedAt === null)
    .flatMap((tracker) =>
      tracker.variants.length > 0 ? variantRows(tracker) : [trackerRow(tracker)],
    )
}

function trackerRow(tracker: Tracker): HomeRow {
  return {
    id: tracker.id,
    trackerId: tracker.id,
    variantId: null,
    name: tracker.name,
    variantLabel: null,
    thresholdDays: effectiveThresholdDays(tracker),
    lastEntryAt: tracker.latestEntry?.occurredAt ?? null,
  }
}

function variantRows(tracker: Tracker): HomeRow[] {
  return tracker.variants.map((variant) => ({
    id: variant.id,
    trackerId: tracker.id,
    variantId: variant.id,
    name: tracker.name,
    variantLabel: variant.name,
    thresholdDays: effectiveThresholdDays(tracker, variant),
    lastEntryAt: variant.latestEntry?.occurredAt ?? null,
  }))
}
