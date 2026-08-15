/**
 * Resolves one `OutboxItem` (src/client/outbox/outboxStore.ts) to what the
 * queued sheet shows: the Tracker name (plus its " · variant" suffix when
 * the item targets a Variant, matching the " · variant" convention used
 * across the app — e.g. src/client/activity/activityRows.ts,
 * src/client/list/formatListRow.ts) and the write's intended time.
 *
 * Deliberately free of React and of the query client (build ticket 19's
 * instructions): the queued sheet already holds the bootstrap payload via
 * useBootstrapQuery and passes it in as a plain argument, which keeps this
 * module a pure function that's trivially testable without rendering
 * anything.
 *
 * A Tracker or Variant referenced by a still-queued write can go missing —
 * deleted locally after the write was queued, or deleted elsewhere and
 * picked up by the next bootstrap fetch before this item ever drained. Both
 * read the same as "not found" here, so the fallback wording ("unknown
 * tracker"/"unknown variant") stays honest either way rather than assuming
 * deletion specifically. A 'delete' item is a different shape of gap: it
 * carries only the Entry id (outboxStore's `OutboxItem` doc comment — the
 * server needs nothing else to delete it), so there is no trackerId to even
 * attempt resolving, and it gets a generic label describing the action
 * instead.
 */
import type { BootstrapPayload } from '../api'
import type { CreateEntryInput } from '../log/entryApi'
import type { OutboxItem } from './outboxStore'

export interface QueuedItemLabel {
  /** the Tracker name (+ " · variant" suffix), or an honest fallback. */
  readonly name: string
  /** the write's intended time, formatted for display. */
  readonly time: string
}

// Locale pinned rather than left to the runtime default, matching
// src/client/detail/entryFormat.ts's formatEntryAbsolute — deterministic in
// tests and consistent across deployments.
const INTENDED_TIME_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

function formatIntendedTime(iso: string): string {
  return INTENDED_TIME_FORMAT.format(new Date(iso))
}

function resolveCreateLabel(input: CreateEntryInput, bootstrap: BootstrapPayload | undefined): string {
  const tracker = bootstrap?.trackers.find((candidate) => candidate.id === input.trackerId)
  if (!tracker) return 'unknown tracker'
  if (input.variantId === null) return tracker.name

  const variant = tracker.variants.find((candidate) => candidate.id === input.variantId)
  return variant ? `${tracker.name} · ${variant.name}` : `${tracker.name} · unknown variant`
}

export function resolveQueuedLabel(item: OutboxItem, bootstrap: BootstrapPayload | undefined): QueuedItemLabel {
  if (item.input === null) {
    // a 'delete' item has no trackerId/variantId to resolve at all.
    return { name: 'removing an entry', time: formatIntendedTime(item.queuedAt) }
  }

  return {
    name: resolveCreateLabel(item.input, bootstrap),
    time: formatIntendedTime(item.input.occurredAt),
  }
}
