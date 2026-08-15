/**
 * Immutable read/write of a single Tracker or Variant's `latestEntry` on the
 * bootstrap query cache (docs/spec.md § API "Bootstrap payload") — the two
 * primitives tap-to-log's optimistic update and its undo both reduce to.
 * Mirrors src/client/tracker/bootstrapCache.ts's style (spread-only, never
 * mutates a cached object) but scoped to Entries: that module owns
 * Tracker/Variant writes, this one owns the one field a log-tap ever
 * touches.
 */
import type { BootstrapPayload, Entry } from '../api'

export interface EntryTarget {
  readonly trackerId: string
  readonly variantId: string | null
}

/** the Tracker's own latestEntry when `variantId` is null, else that Variant's. */
export function findLatestEntry(payload: BootstrapPayload, target: EntryTarget): Entry | null {
  const tracker = payload.trackers.find((t) => t.id === target.trackerId)
  if (!tracker) return null
  if (target.variantId === null) return tracker.latestEntry
  return tracker.variants.find((v) => v.id === target.variantId)?.latestEntry ?? null
}

/**
 * Sets `entry` as the Tracker's or Variant's latestEntry. Used both to apply
 * a log optimistically (`entry` is the new Entry) and to undo one (`entry`
 * is the previous value, possibly null). A `trackerId`/`variantId` that
 * doesn't resolve to a row leaves the payload's trackers array unchanged
 * (still a fresh copy, per this repo's no-mutation rule) rather than
 * throwing — the row may have been deleted mid-window.
 */
export function setLatestEntryInCache(
  payload: BootstrapPayload,
  target: EntryTarget & { entry: Entry | null },
): BootstrapPayload {
  return {
    ...payload,
    trackers: payload.trackers.map((tracker) => {
      if (tracker.id !== target.trackerId) return tracker
      if (target.variantId === null) {
        return { ...tracker, latestEntry: target.entry }
      }
      return {
        ...tracker,
        variants: tracker.variants.map((variant) =>
          variant.id === target.variantId ? { ...variant, latestEntry: target.entry } : variant,
        ),
      }
    }),
  }
}
