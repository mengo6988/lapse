/**
 * Every write to the cached bootstrap payload (docs/spec.md § API
 * "Bootstrap payload"), so a screen reading Trackers, Variants, Categories or
 * a latest Entry through `useBootstrapQuery` sees the result of a mutation
 * immediately, with no refetch. Callers ask for the domain change they made —
 * a Tracker was added, a Category was deleted — and this module knows how
 * that lands on the cached shape; nothing outside it touches the payload
 * directly.
 *
 * The Tracker/Variant write routes (src/server/routes/trackers.ts) return the
 * Drizzle row shape, which has no `latestEntry` — `addTracker`/`patchTracker`
 * and `addVariant`/`patchVariant` graft that field back on, defaulting to
 * null for anything the cache hasn't seen before and carrying the existing
 * value forward otherwise.
 */
import type { BootstrapPayload, Category, Entry, Tracker, Variant } from '../api'

/** wire shape returned by POST /trackers and PATCH /trackers/:id. */
export interface TrackerMutationResponse {
  id: string
  name: string
  categoryId: string | null
  thresholdDays: number | null
  archivedAt: string | null
  createdAt: string
  variants: VariantMutationResponse[]
}

/** wire shape returned by POST /trackers/:id/variants and PATCH /variants/:id. */
export interface VariantMutationResponse {
  id: string
  trackerId: string
  name: string
  thresholdDays: number | null
  deletedAt: string | null
  createdAt: string
}

export interface EntryTarget {
  readonly trackerId: string
  readonly variantId: string | null
}

function toBootstrapVariant(response: VariantMutationResponse, existingById: Map<string, Variant>): Variant {
  return {
    id: response.id,
    name: response.name,
    thresholdDays: response.thresholdDays,
    latestEntry: existingById.get(response.id)?.latestEntry ?? null,
  }
}

function toBootstrapTracker(response: TrackerMutationResponse): Tracker {
  return {
    id: response.id,
    name: response.name,
    categoryId: response.categoryId,
    thresholdDays: response.thresholdDays,
    archivedAt: response.archivedAt,
    createdAt: response.createdAt,
    latestEntry: null,
    variants: response.variants.map((v) => toBootstrapVariant(v, new Map())),
  }
}

/** POST /trackers succeeded: append the new Tracker to the cache. */
export function addTracker(payload: BootstrapPayload, response: TrackerMutationResponse): BootstrapPayload {
  return { ...payload, trackers: [...payload.trackers, toBootstrapTracker(response)] }
}

/**
 * PATCH /trackers/:id succeeded: merge the changed fields onto the cached
 * Tracker and replace its variants with the response's list (authoritative —
 * `withVariants` on the server excludes soft-deleted rows, so anything
 * missing here was removed elsewhere in this edit session).
 */
export function patchTracker(payload: BootstrapPayload, response: TrackerMutationResponse): BootstrapPayload {
  const existing = payload.trackers.find((t) => t.id === response.id)
  if (!existing) return { ...payload }

  const existingVariantsById = new Map(existing.variants.map((v) => [v.id, v]))

  return {
    ...payload,
    trackers: payload.trackers.map((tracker) =>
      tracker.id === response.id
        ? {
            ...tracker,
            name: response.name,
            categoryId: response.categoryId,
            thresholdDays: response.thresholdDays,
            archivedAt: response.archivedAt,
            variants: response.variants.map((v) => toBootstrapVariant(v, existingVariantsById)),
          }
        : tracker,
    ),
  }
}

/** POST /trackers/:id/variants succeeded: append the new Variant to its parent. */
export function addVariant(payload: BootstrapPayload, trackerId: string, response: VariantMutationResponse): BootstrapPayload {
  return {
    ...payload,
    trackers: payload.trackers.map((tracker) =>
      tracker.id === trackerId
        ? { ...tracker, variants: [...tracker.variants, toBootstrapVariant(response, new Map())] }
        : tracker,
    ),
  }
}

/** PATCH /variants/:id succeeded: merge the rename/threshold change in place. */
export function patchVariant(payload: BootstrapPayload, trackerId: string, response: VariantMutationResponse): BootstrapPayload {
  return {
    ...payload,
    trackers: payload.trackers.map((tracker) => {
      if (tracker.id !== trackerId) return tracker
      const existingById = new Map(tracker.variants.map((v) => [v.id, v]))
      return {
        ...tracker,
        variants: tracker.variants.map((v) => (v.id === response.id ? toBootstrapVariant(response, existingById) : v)),
      }
    }),
  }
}

/** DELETE /variants/:id succeeded (soft delete): drop it from its parent. */
export function removeVariant(payload: BootstrapPayload, trackerId: string, variantId: string): BootstrapPayload {
  return {
    ...payload,
    trackers: payload.trackers.map((tracker) =>
      tracker.id === trackerId ? { ...tracker, variants: tracker.variants.filter((v) => v.id !== variantId) } : tracker,
    ),
  }
}

/** DELETE /trackers/:id succeeded (hard delete, archived Trackers only): drop it from the cache. */
export function removeTracker(payload: BootstrapPayload, trackerId: string): BootstrapPayload {
  return { ...payload, trackers: payload.trackers.filter((tracker) => tracker.id !== trackerId) }
}

/** POST /categories succeeded: append the new Category to the cache. */
export function addCategory(payload: BootstrapPayload, category: Category): BootstrapPayload {
  return { ...payload, categories: [...payload.categories, category] }
}

/** PATCH /categories/:id succeeded: replace the changed Category in place. */
export function patchCategory(payload: BootstrapPayload, category: Category): BootstrapPayload {
  return {
    ...payload,
    categories: payload.categories.map((existing) => (existing.id === category.id ? category : existing)),
  }
}

/**
 * DELETE /categories/:id succeeded: drop the Category and null out
 * `categoryId` on every Tracker that pointed at it, mirroring the server's
 * `on delete set null` (src/server/routes/categories.ts) — otherwise the
 * client cache would disagree with the database (still showing a chip for a
 * Category that no longer exists) until the next full bootstrap.
 */
export function removeCategory(payload: BootstrapPayload, categoryId: string): BootstrapPayload {
  return {
    ...payload,
    categories: payload.categories.filter((category) => category.id !== categoryId),
    trackers: payload.trackers.map((tracker) =>
      tracker.categoryId === categoryId ? { ...tracker, categoryId: null } : tracker,
    ),
  }
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
