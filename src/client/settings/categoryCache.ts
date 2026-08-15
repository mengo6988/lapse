/**
 * Immutable Category cache updates for the bootstrap payload (docs/spec.md §
 * API "Bootstrap payload"), mirroring the cache-surgery idiom of
 * src/client/tracker/bootstrapCache.ts and src/client/archived/
 * archivedCache.ts — neither of which this ticket may edit, and neither of
 * which has a Category helper (bootstrapCache.ts only covers
 * Trackers/Variants).
 *
 * `removeCategoryFromCache` also nulls `categoryId` on every Tracker that
 * referenced the deleted Category, mirroring the server's `on delete set
 * null` (src/server/routes/categories.ts) — otherwise the client cache would
 * disagree with the database (still showing a chip for a Category that no
 * longer exists) until the next full bootstrap (build ticket 22, decision 4).
 */
import type { BootstrapPayload, Category } from '../api'

/** POST /categories succeeded: append the new Category to the cache. */
export function addCategoryToCache(payload: BootstrapPayload, category: Category): BootstrapPayload {
  return { ...payload, categories: [...payload.categories, category] }
}

/** PATCH /categories/:id succeeded: replace the changed Category in place. */
export function patchCategoryInCache(payload: BootstrapPayload, category: Category): BootstrapPayload {
  return {
    ...payload,
    categories: payload.categories.map((existing) => (existing.id === category.id ? category : existing)),
  }
}

/**
 * DELETE /categories/:id succeeded: drop the Category and null out
 * `categoryId` on every Tracker that pointed at it.
 */
export function removeCategoryFromCache(payload: BootstrapPayload, categoryId: string): BootstrapPayload {
  return {
    ...payload,
    categories: payload.categories.filter((category) => category.id !== categoryId),
    trackers: payload.trackers.map((tracker) =>
      tracker.categoryId === categoryId ? { ...tracker, categoryId: null } : tracker,
    ),
  }
}
