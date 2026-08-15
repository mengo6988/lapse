/**
 * Threshold preset tiers (docs/design.md § Create/Edit Tracker: "preset chips
 * 1w / 2w / 1m / 3m / 6m / 1y + custom"). Stolen-from-research pattern per
 * docs/spec.md: fixed tiers instead of a raw number input. Months/years are
 * calendar approximations (30d / 365d), matching the server's plain integer
 * `thresholdDays` column — there's no calendar-aware storage to approximate.
 */
export interface ThresholdPreset {
  readonly label: string
  readonly days: number
}

export const THRESHOLD_PRESETS: readonly ThresholdPreset[] = [
  { label: '1w', days: 7 },
  { label: '2w', days: 14 },
  { label: '1m', days: 30 },
  { label: '3m', days: 90 },
  { label: '6m', days: 180 },
  { label: '1y', days: 365 },
]

export type ThresholdUnit = 'day' | 'week' | 'month' | 'year'

const UNIT_DAYS: Record<ThresholdUnit, number> = { day: 1, week: 7, month: 30, year: 365 }

export const THRESHOLD_UNITS: readonly { value: ThresholdUnit; label: string }[] = [
  { value: 'day', label: 'days' },
  { value: 'week', label: 'weeks' },
  { value: 'month', label: 'months' },
  { value: 'year', label: 'years' },
]

/** the preset tier an existing thresholdDays value came from, if any. */
export function presetMatching(thresholdDays: number | null): ThresholdPreset | undefined {
  if (thresholdDays === null) return undefined
  return THRESHOLD_PRESETS.find((preset) => preset.days === thresholdDays)
}

/** custom (number + unit) -> whole days, or null for an unusable amount. */
export function daysFromCustomInput(amount: number, unit: ThresholdUnit): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * UNIT_DAYS[unit])
}
