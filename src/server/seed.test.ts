import { describe, expect, it } from 'vitest'
import { createTestDb } from './testing.js'
import { seedCategories } from './seed.js'
import { categories } from './schema.js'

describe('seedCategories', () => {
  it('seeds the four starter categories with colors on a fresh database', () => {
    const db = createTestDb()

    seedCategories(db)

    const rows = db.select().from(categories).all()
    expect(rows.map((row) => row.name).sort()).toEqual(['car', 'health', 'house', 'personal'])
    expect(rows.every((row) => /^#[0-9a-f]{6}$/.test(row.color))).toBe(true)
    expect(rows.every((row) => row.id.length > 0 && row.createdAt.length > 0)).toBe(true)
  })

  it('is idempotent across boots against the same database', () => {
    const db = createTestDb()

    seedCategories(db)
    seedCategories(db)

    expect(db.select().from(categories).all()).toHaveLength(4)
  })

  it('leaves a user-modified category set alone', () => {
    const db = createTestDb()
    seedCategories(db)
    db.delete(categories).run()
    db.insert(categories)
      .values({ id: 'x', name: 'boat', color: '#f38ba8', createdAt: new Date().toISOString() })
      .run()

    seedCategories(db)

    expect(db.select().from(categories).all()).toHaveLength(1)
  })
})
