/**
 * "Xd ago" for a row's last Entry, per docs/spec.md's "displayed and
 * day-bucketed in device-local time" rule. This buckets at device-local
 * midnight rather than urgencyRatio's continuous 24h math: an Entry logged
 * at 23:30 yesterday reads "1 day ago" the instant the local clock crosses
 * midnight, which is how a glance at "last done Xd ago" is meant to read.
 * (urgencyRatio deliberately stays continuous — sorting needs the finer
 * precision, display doesn't.) Null when there's no Entry yet; never
 * negative, matching urgencyRatio's clamp for a clock-skewed future Entry.
 */

const MS_PER_DAY = 86_400_000

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysAgo(lastEntryAt: string | null, now: Date): number | null {
  if (lastEntryAt === null) return null

  const elapsedDays = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(new Date(lastEntryAt)).getTime()) /
      MS_PER_DAY,
  )

  return Math.max(0, elapsedDays)
}
