/**
 * Effective Threshold per docs/spec.md § Domain rules: a Variant's own
 * thresholdDays wins, null inherits the parent Tracker's, and a
 * thresholdless Tracker can still have thresholded Variants. Urgency ratio
 * and the "every Yd" subtitle always use this resolved value, never the
 * Variant's or Tracker's raw field directly.
 */

export interface ThresholdSource {
  readonly thresholdDays: number | null
}

export function effectiveThresholdDays(
  tracker: ThresholdSource,
  variant?: ThresholdSource | null,
): number | null {
  if (variant == null) return tracker.thresholdDays
  return variant.thresholdDays ?? tracker.thresholdDays
}
