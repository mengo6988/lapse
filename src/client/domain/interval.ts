/**
 * Observed interval per docs/spec.md § Domain rules: the mean gap, in days,
 * between the most recent Entries (up to the last 10), computed per-Variant
 * for Variant rows. Undefined (null) until at least 3 Entries exist — a
 * mean of one gap isn't a pattern yet. Feeds the "actually every ~Nd" line
 * and the Threshold suggestion.
 */

const MS_PER_DAY = 86_400_000
const RECENT_ENTRIES_CONSIDERED = 10
const MIN_ENTRIES_FOR_OBSERVED_INTERVAL = 3

export function observedIntervalDays(entryTimestamps: readonly string[]): number | null {
  if (entryTimestamps.length < MIN_ENTRIES_FOR_OBSERVED_INTERVAL) return null

  const newestFirst = [...entryTimestamps]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, RECENT_ENTRIES_CONSIDERED)

  const gaps = gapsInDays(newestFirst)
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
}

function gapsInDays(timestampsNewestFirst: readonly string[]): number[] {
  const gaps: number[] = []
  let previous: string | null = null

  for (const current of timestampsNewestFirst) {
    if (previous !== null) {
      gaps.push((new Date(previous).getTime() - new Date(current).getTime()) / MS_PER_DAY)
    }
    previous = current
  }

  return gaps
}
