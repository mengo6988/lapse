import { observedIntervalDays } from './interval'

/**
 * Threshold suggestion per docs/spec.md § Features (9, 10): once at least 3
 * Entries exist and the observed interval strays more than 30% from the
 * current Threshold, offer to update it — either direction, since logging
 * more often or less often than the Threshold assumes is equally worth a
 * nudge. A thresholdless Tracker with the same 3+ Entries gets the gentler
 * "set a threshold?" case instead. Never fires on the home list, only on
 * tracker detail — this function just answers the question, the screen
 * decides where to show it.
 */

export type ThresholdSuggestion =
  | { readonly kind: 'set'; readonly observedIntervalDays: number }
  | { readonly kind: 'update'; readonly observedIntervalDays: number }
  | null

const DEVIATION_THRESHOLD = 0.3

export function suggestThreshold(
  thresholdDays: number | null,
  entryTimestamps: readonly string[],
): ThresholdSuggestion {
  const observed = observedIntervalDays(entryTimestamps)
  if (observed === null) return null

  if (thresholdDays === null) {
    return { kind: 'set', observedIntervalDays: observed }
  }

  const deviation = Math.abs(observed - thresholdDays) / thresholdDays
  if (deviation > DEVIATION_THRESHOLD) {
    return { kind: 'update', observedIntervalDays: observed }
  }

  return null
}
