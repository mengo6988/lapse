/**
 * Row-level copy for the entry history list (docs/design.md § Tracker
 * detail / history: "relative + absolute time"). Distinct from
 * src/client/list/formatListRow.ts, which formats a Tracker/Variant's
 * *last-done* line for a home/list row — this formats one historical Entry
 * for the detail screen's flat list, a different subject entirely, so it
 * isn't a second copy of that formatter.
 */
import { daysAgo } from '../domain/daysAgo'

export function formatEntryRelative(occurredAt: string, now: Date): string {
  const days = daysAgo(occurredAt, now) ?? 0
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

// Locale pinned rather than left to the runtime default so this format is
// deterministic in tests and consistent across deployments — matching the
// domain layer's stance of never depending on ambient environment state.
const ABSOLUTE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function formatEntryAbsolute(occurredAt: string): string {
  return ABSOLUTE_FORMAT.format(new Date(occurredAt))
}
