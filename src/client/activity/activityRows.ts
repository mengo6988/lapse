/**
 * Resolves each Entry's Tracker/Variant name from the bootstrap cache
 * (build ticket 21: `GET /entries` stays a dumb row list per ADR-0001 — the
 * client already holds every Tracker and Variant name via
 * src/client/query/useBootstrap.ts, so the resolution happens here rather
 * than the server growing a join). Entries belonging to archived Trackers
 * never reach this function — the server filters them out
 * (src/server/routes/entries.ts), matching how they're hidden everywhere
 * else in the UI (docs/spec.md § Idempotency).
 *
 * A deleted Variant's name falls out of the bootstrap payload (docs/spec.md
 * § Data model: "deleted variants excluded from bootstrap/home"), so a
 * still-existing Entry that references one resolves to a null
 * `variantName` here — the same gap
 * src/client/detail/EntryHistoryList.tsx's `variantLabelFor` already
 * accepts for the single-Tracker history list; this doesn't newly invent
 * it.
 */
import type { Entry, Tracker } from '../api'

export interface ActivityRow {
  readonly id: string
  readonly trackerId: string
  readonly variantId: string | null
  readonly trackerName: string
  readonly variantName: string | null
  readonly occurredAt: string
  readonly durationMinutes: number | null
  readonly note: string | null
}

export function buildActivityRows(entries: readonly Entry[], trackers: readonly Tracker[]): ActivityRow[] {
  const trackerById = new Map(trackers.map((tracker) => [tracker.id, tracker]))

  return entries.flatMap((entry) => {
    const tracker = trackerById.get(entry.trackerId)
    // A dangling trackerId (bootstrap cache stale relative to this fetch)
    // has nothing to display, so it's skipped rather than crashing the
    // feed — `entries.trackerId` cascades on Tracker hard-delete
    // (src/server/schema.ts), so this should be unreachable in practice.
    if (!tracker) return []

    const variant = entry.variantId === null ? null : tracker.variants.find((v) => v.id === entry.variantId)

    const row: ActivityRow = {
      id: entry.id,
      trackerId: entry.trackerId,
      variantId: entry.variantId,
      trackerName: tracker.name,
      variantName: variant?.name ?? null,
      occurredAt: entry.occurredAt,
      durationMinutes: entry.durationMinutes,
      note: entry.note,
    }
    return [row]
  })
}
