import { asc, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Entry, Tracker, Variant } from '../schema.js'
import { categories, entries, trackers, variants } from '../schema.js'
import type { RouteDeps } from './deps.js'

/**
 * The latest of a set of Entries by `occurredAt`, with `id` descending as the
 * tiebreak. `null` when the set is empty.
 */
function latestOf(rows: Entry[]): Entry | null {
  return rows.reduce<Entry | null>((latest, row) => {
    if (!latest) return row
    if (row.occurredAt > latest.occurredAt) return row
    if (row.occurredAt === latest.occurredAt && row.id > latest.id) return row
    return latest
  }, null)
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const row of rows) {
    const existing = groups.get(key(row))
    if (existing) {
      existing.push(row)
    } else {
      groups.set(key(row), [row])
    }
  }
  return groups
}

function variantPayload(variant: Variant, entriesForTracker: Entry[]) {
  const own = entriesForTracker.filter((entry) => entry.variantId === variant.id)
  return {
    id: variant.id,
    name: variant.name,
    thresholdDays: variant.thresholdDays,
    latestEntry: latestOf(own),
  }
}

function trackerPayload(
  tracker: Tracker,
  entriesByTracker: Map<string, Entry[]>,
  variantsByTracker: Map<string, Variant[]>,
) {
  const entriesForTracker = entriesByTracker.get(tracker.id) ?? []
  const variantsForTracker = variantsByTracker.get(tracker.id) ?? []
  const variantless = entriesForTracker.filter((entry) => entry.variantId === null)

  return {
    id: tracker.id,
    name: tracker.name,
    categoryId: tracker.categoryId,
    thresholdDays: tracker.thresholdDays,
    archivedAt: tracker.archivedAt,
    createdAt: tracker.createdAt,
    latestEntry: latestOf(variantless),
    variants: variantsForTracker.map((variant) => variantPayload(variant, entriesForTracker)),
  }
}

/**
 * The launch-time payload. Path is declared relative to the `/api` mount in
 * app.ts (so `/bootstrap`). Fetches each table once and assembles the
 * response in memory to avoid a query per Tracker.
 */
export function bootstrapRoutes({ db }: RouteDeps) {
  const app = new Hono()

  app.get('/bootstrap', (c) => {
    const categoryRows = db.select().from(categories).orderBy(asc(categories.createdAt)).all()
    const trackerRows = db.select().from(trackers).orderBy(asc(trackers.createdAt)).all()
    // Soft-deleted Variants are excluded from bootstrap/home per docs/spec.md.
    const variantRows = db.select().from(variants).where(isNull(variants.deletedAt)).all()
    const entryRows = db.select().from(entries).all()

    const entriesByTracker = groupBy(entryRows, (entry) => entry.trackerId)
    const variantsByTracker = groupBy(variantRows, (variant) => variant.trackerId)

    return c.json({
      categories: categoryRows,
      trackers: trackerRows.map((tracker) => trackerPayload(tracker, entriesByTracker, variantsByTracker)),
    })
  })

  return app
}
