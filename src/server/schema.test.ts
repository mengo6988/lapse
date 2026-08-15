import { describe, expect, it } from 'vitest'
import { createTestDb } from './testing.js'
import { categories, entries, trackers, variants } from './schema.js'

const now = () => new Date().toISOString()

const seedTracker = (db: ReturnType<typeof createTestDb>) => {
  db.insert(categories).values({ id: 'c1', name: 'car', color: '#f9e2af', createdAt: now() }).run()
  db.insert(trackers)
    .values({ id: 't1', name: 'Tyre pressure', categoryId: 'c1', thresholdDays: 30, createdAt: now() })
    .run()
  db.insert(variants)
    .values({ id: 'v1', trackerId: 't1', name: 'volvo', thresholdDays: null, createdAt: now() })
    .run()
  db.insert(entries)
    .values({ id: 'e1', trackerId: 't1', variantId: 'v1', occurredAt: now(), createdAt: now() })
    .run()
  return db
}

describe('schema', () => {
  it('cascades a tracker hard delete to its variants and entries', () => {
    const db = seedTracker(createTestDb())

    db.delete(trackers).run()

    expect(db.select().from(variants).all()).toHaveLength(0)
    expect(db.select().from(entries).all()).toHaveLength(0)
  })

  it('leaves trackers uncategorised when their category is deleted', () => {
    const db = seedTracker(createTestDb())

    db.delete(categories).run()

    expect(db.select().from(trackers).all()[0]?.categoryId).toBeNull()
  })

  it('keeps entries labelled when a variant is soft deleted', () => {
    const db = seedTracker(createTestDb())

    db.update(variants).set({ deletedAt: now() }).run()

    expect(db.select().from(entries).all()[0]?.variantId).toBe('v1')
    expect(db.select().from(variants).all()[0]?.deletedAt).not.toBeNull()
  })

  it('carries the indexes the read paths depend on', () => {
    const db = createTestDb()

    const indexes = db.$client
      .prepare("select name from sqlite_master where type = 'index'")
      .all() as { name: string }[]

    expect(indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining([
        'entries_tracker_id_occurred_at_idx',
        'entries_variant_id_idx',
        'variants_tracker_id_idx',
        'trackers_category_id_idx',
      ]),
    )
  })
})
