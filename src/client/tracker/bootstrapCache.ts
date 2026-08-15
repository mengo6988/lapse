/**
 * Immutable merges of a Tracker/Variant mutation response into the bootstrap
 * query cache (docs/spec.md § API "Bootstrap payload"), so the home and list
 * screens see a new/changed Tracker without waiting on a refetch. The
 * mutation routes (src/server/routes/trackers.ts) return the Drizzle row
 * shape, which has no `latestEntry` — these functions graft that field back
 * on, defaulting to null for anything the cache hasn't seen before and
 * carrying the existing value forward otherwise.
 */
import type { BootstrapPayload, Tracker, Variant } from '../api'

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
export function addTrackerToCache(payload: BootstrapPayload, response: TrackerMutationResponse): BootstrapPayload {
  return { ...payload, trackers: [...payload.trackers, toBootstrapTracker(response)] }
}

/**
 * PATCH /trackers/:id succeeded: merge the changed fields onto the cached
 * Tracker and replace its variants with the response's list (authoritative —
 * `withVariants` on the server excludes soft-deleted rows, so anything
 * missing here was removed elsewhere in this edit session).
 */
export function patchTrackerInCache(payload: BootstrapPayload, response: TrackerMutationResponse): BootstrapPayload {
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
export function addVariantToCache(
  payload: BootstrapPayload,
  trackerId: string,
  response: VariantMutationResponse,
): BootstrapPayload {
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
export function patchVariantInCache(
  payload: BootstrapPayload,
  trackerId: string,
  response: VariantMutationResponse,
): BootstrapPayload {
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
export function removeVariantFromCache(payload: BootstrapPayload, trackerId: string, variantId: string): BootstrapPayload {
  return {
    ...payload,
    trackers: payload.trackers.map((tracker) =>
      tracker.id === trackerId ? { ...tracker, variants: tracker.variants.filter((v) => v.id !== variantId) } : tracker,
    ),
  }
}
