import { urgencyRatio } from './urgency'

/**
 * The minimal shape sortByUrgency needs: a row's already-resolved effective
 * Threshold (see threshold.ts for Variant inheritance) and its own last
 * Entry timestamp. Callers pass richer row types — Tracker rows, Variant
 * rows — which structurally satisfy this.
 */
export interface UrgencySortable {
  readonly thresholdDays: number | null
  readonly lastEntryAt: string | null
}

type Bucket = 0 | 1 | 2 | 3

// 0: thresholded, never logged. 1: thresholded, logged. 2: thresholdless,
// never logged. 3: thresholdless, logged. Matches docs/spec.md § Sorting
// top to bottom.
function bucketOf(row: UrgencySortable): Bucket {
  if (row.thresholdDays !== null) {
    return row.lastEntryAt === null ? 0 : 1
  }
  return row.lastEntryAt === null ? 2 : 3
}

/**
 * Home/List row order per docs/spec.md § Sorting: thresholded never-logged
 * first, then thresholded rows by descending ratio, then thresholdless
 * rows below everything (never-logged first, then longest since logged).
 * Returns a closure over `now` so it can be handed straight to Array#sort;
 * bucket ties within "never logged" groups have no specified order and
 * fall back to Array#sort's guaranteed stability, preserving input order.
 */
export function urgencyComparator(now: Date) {
  return (a: UrgencySortable, b: UrgencySortable): number => {
    const bucketDiff = bucketOf(a) - bucketOf(b)
    if (bucketDiff !== 0) return bucketDiff

    if (bucketOf(a) === 1) {
      const ratioA = urgencyRatio(a.lastEntryAt, a.thresholdDays, now)!
      const ratioB = urgencyRatio(b.lastEntryAt, b.thresholdDays, now)!
      return ratioB - ratioA
    }

    if (bucketOf(a) === 3) {
      // longest since logged first = oldest lastEntryAt first
      return new Date(a.lastEntryAt!).getTime() - new Date(b.lastEntryAt!).getTime()
    }

    return 0
  }
}

/**
 * Sorts rows for the home/list read model per docs/spec.md § Sorting.
 * Always copies before sorting — Array#sort mutates in place, and this repo
 * never mutates an input.
 */
export function sortByUrgency<T extends UrgencySortable>(rows: readonly T[], now: Date): T[] {
  return [...rows].sort(urgencyComparator(now))
}
