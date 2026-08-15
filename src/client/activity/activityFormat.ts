/**
 * Row-level copy for one Activity Entry (build ticket 21 acceptance
 * criterion: "each showing ... a relative time, and duration or note when
 * present").
 *
 * The relative time is carried by the day-bucket heading this row sits
 * under (src/client/activity/dayBuckets.ts: "today" / "yesterday" / "aug
 * 1"), so the row itself shows the local clock time instead of repeating
 * the same word on every row of a section. That also follows
 * docs/design.md's rule for the single-Tracker history list this screen is
 * the cross-Tracker analogue of — "relative + absolute time" — with the
 * relative half hoisted to the heading, where it's stated once.
 *
 * Locale is pinned to en-US to match dayBuckets.ts's headings, then
 * lowercased per docs/design.md § Copy tone.
 */
const CLOCK_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function formatEntryTime(occurredAt: string): string {
  return CLOCK_TIME.format(new Date(occurredAt)).toLowerCase()
}

export function formatEntryMeta(durationMinutes: number | null, note: string | null): string | null {
  const parts = [durationMinutes !== null ? `${durationMinutes}m` : null, note].filter(
    (part): part is string => part !== null,
  )
  return parts.length > 0 ? parts.join(' · ') : null
}
