import type { Entry, Tracker, Variant } from '../api'

/**
 * builder helpers shared by this directory's test files — not exercised by
 * production code. Keeps Tracker/Variant/Entry fixture construction out of
 * every individual test file.
 */

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

interface MakeEntryOptions {
  readonly occurredAt: string
}

export function makeEntry({ occurredAt }: MakeEntryOptions): Entry {
  return {
    id: nextId('entry'),
    trackerId: nextId('entry-tracker-ref'),
    variantId: null,
    occurredAt,
    durationMinutes: null,
    note: null,
    createdAt: occurredAt,
  }
}

interface MakeVariantOptions {
  readonly name: string
  readonly thresholdDays?: number | null
  readonly latestEntry?: Entry | null
}

export function makeVariant({
  name,
  thresholdDays = null,
  latestEntry = null,
}: MakeVariantOptions): Variant {
  return { id: nextId('variant'), name, thresholdDays, latestEntry }
}

interface MakeTrackerOptions {
  readonly name: string
  readonly thresholdDays?: number | null
  readonly latestEntry?: Entry | null
  readonly variants?: readonly Variant[]
  readonly archivedAt?: string | null
}

export function makeTracker({
  name,
  thresholdDays = null,
  latestEntry = null,
  variants = [],
  archivedAt = null,
}: MakeTrackerOptions): Tracker {
  return {
    id: nextId('tracker'),
    name,
    categoryId: null,
    thresholdDays,
    archivedAt,
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry,
    variants: [...variants],
  }
}

/** an ISO timestamp `days` before real wall-clock now — mirrors the domain test suites' `daysAgo` helper. */
export function isoDaysAgo(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString()
}
