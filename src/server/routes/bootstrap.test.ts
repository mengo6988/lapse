import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { Db } from '../db.js'
import { categories, entries, trackers, variants } from '../schema.js'
import { createTestDb } from '../testing.js'

const PASSWORD = 'test'

async function buildAuthedApp() {
  const db = createTestDb()
  const app = createApp({ db, password: PASSWORD })
  const login = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  return { app, db, cookie }
}

function insertCategory(db: Db, overrides: Partial<{ id: string; name: string; color: string; createdAt: string }> = {}) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'house',
    color: overrides.color ?? '#89b4fa',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }
  db.insert(categories).values(row).run()
  return row
}

function insertTracker(
  db: Db,
  overrides: Partial<{
    id: string
    name: string
    categoryId: string | null
    thresholdDays: number | null
    archivedAt: string | null
    createdAt: string
  }> = {},
) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'vacuum',
    categoryId: overrides.categoryId ?? null,
    thresholdDays: overrides.thresholdDays ?? null,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }
  db.insert(trackers).values(row).run()
  return row
}

function insertVariant(
  db: Db,
  overrides: Partial<{
    id: string
    trackerId: string
    name: string
    thresholdDays: number | null
    deletedAt: string | null
    createdAt: string
  }> & { trackerId: string },
) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    trackerId: overrides.trackerId,
    name: overrides.name ?? 'volvo',
    thresholdDays: overrides.thresholdDays ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }
  db.insert(variants).values(row).run()
  return row
}

function insertEntry(
  db: Db,
  overrides: Partial<{
    id: string
    trackerId: string
    variantId: string | null
    occurredAt: string
    durationMinutes: number | null
    note: string | null
    createdAt: string
  }> & { trackerId: string },
) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    trackerId: overrides.trackerId,
    variantId: overrides.variantId ?? null,
    occurredAt: overrides.occurredAt ?? new Date().toISOString(),
    durationMinutes: overrides.durationMinutes ?? null,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }
  db.insert(entries).values(row).run()
  return row
}

type BootstrapBody = {
  categories: unknown[]
  trackers: Array<{
    id: string
    name: string
    categoryId: string | null
    thresholdDays: number | null
    archivedAt: string | null
    createdAt: string
    latestEntry: { id: string; occurredAt: string } | null
    variants: Array<{ id: string; name: string; thresholdDays: number | null; latestEntry: { id: string } | null }>
  }>
}

describe('GET /api/bootstrap', () => {
  it('returns empty arrays when nothing exists', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(res.status).toBe(200)
    expect(body).toEqual({ categories: [], trackers: [] })
  })

  it('includes categories', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    insertCategory(db, { name: 'car', color: '#f9e2af' })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.categories).toHaveLength(1)
    expect(body.categories[0]).toMatchObject({ name: 'car', color: '#f9e2af' })
  })

  it('emits exactly the spec fields for a tracker with no entries or variants', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const category = insertCategory(db)
    insertTracker(db, { name: 'vacuum', categoryId: category.id, thresholdDays: 14 })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.trackers).toHaveLength(1)
    const tracker = body.trackers[0]!
    expect(Object.keys(tracker).sort()).toEqual(
      ['archivedAt', 'categoryId', 'createdAt', 'id', 'latestEntry', 'name', 'thresholdDays', 'variants'].sort(),
    )
    expect(tracker).toMatchObject({
      name: 'vacuum',
      categoryId: category.id,
      thresholdDays: 14,
      archivedAt: null,
      latestEntry: null,
      variants: [],
    })
  })

  it("uses only the tracker's latest variantless entry, ignoring variant entries", async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const tracker = insertTracker(db)
    const variant = insertVariant(db, { trackerId: tracker.id })
    insertEntry(db, { trackerId: tracker.id, variantId: null, occurredAt: '2026-01-01T00:00:00.000Z' })
    const latestVariantless = insertEntry(db, {
      trackerId: tracker.id,
      variantId: null,
      occurredAt: '2026-01-05T00:00:00.000Z',
    })
    // Later than both variantless entries, but must not leak into the tracker's latestEntry.
    insertEntry(db, { trackerId: tracker.id, variantId: variant.id, occurredAt: '2026-06-01T00:00:00.000Z' })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.trackers[0]!.latestEntry?.id).toBe(latestVariantless.id)
  })

  it("emits exactly the spec fields for a variant and uses its own latest entry", async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const tracker = insertTracker(db)
    const variant = insertVariant(db, { trackerId: tracker.id, name: 'volvo', thresholdDays: 30 })
    insertEntry(db, { trackerId: tracker.id, variantId: variant.id, occurredAt: '2026-01-01T00:00:00.000Z' })
    const latestForVariant = insertEntry(db, {
      trackerId: tracker.id,
      variantId: variant.id,
      occurredAt: '2026-02-01T00:00:00.000Z',
    })
    // A variantless entry, later still, must not leak into the variant's latestEntry.
    insertEntry(db, { trackerId: tracker.id, variantId: null, occurredAt: '2026-03-01T00:00:00.000Z' })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.trackers[0]!.variants).toHaveLength(1)
    const variantBody = body.trackers[0]!.variants[0]!
    expect(Object.keys(variantBody).sort()).toEqual(['id', 'latestEntry', 'name', 'thresholdDays'].sort())
    expect(variantBody).toMatchObject({ id: variant.id, name: 'volvo', thresholdDays: 30 })
    expect(variantBody.latestEntry?.id).toBe(latestForVariant.id)
  })

  it('breaks a same-occurredAt tie by the greater entry id', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const tracker = insertTracker(db)
    const occurredAt = '2026-01-01T00:00:00.000Z'
    insertEntry(db, { trackerId: tracker.id, occurredAt, id: 'aaaaaaaa-0000-7000-8000-000000000001' })
    const higherId = insertEntry(db, { trackerId: tracker.id, occurredAt, id: 'bbbbbbbb-0000-7000-8000-000000000002' })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.trackers[0]!.latestEntry?.id).toBe(higherId.id)
  })

  it('includes archived trackers with archivedAt set', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    insertTracker(db, { name: 'old chore', archivedAt: '2026-01-01T00:00:00.000Z' })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.trackers).toHaveLength(1)
    expect(body.trackers[0]!.archivedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('excludes soft-deleted variants', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const tracker = insertTracker(db)
    insertVariant(db, { trackerId: tracker.id, name: 'deleted one', deletedAt: '2026-01-01T00:00:00.000Z' })
    const alive = insertVariant(db, { trackerId: tracker.id, name: 'alive one' })

    const res = await app.request('/api/bootstrap', { headers: { cookie } })
    const body = (await res.json()) as BootstrapBody

    expect(body.trackers[0]!.variants).toHaveLength(1)
    expect(body.trackers[0]!.variants[0]!.id).toBe(alive.id)
  })
})
