import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { uuidv7 } from 'uuidv7'
import type { Db } from '../db.js'
import { entries, trackers, variants } from '../schema.js'
import { createTestDb } from '../testing.js'
import { daysSince, loggableRows, matchRow, slippingRows, type LoggableRow } from './rows.js'

const NOW = new Date('2026-08-22T12:00:00.000Z')

function addTracker(
  db: Db,
  name: string,
  overrides: { thresholdDays?: number | null; archivedAt?: string | null } = {},
): string {
  const id = uuidv7()
  db.insert(trackers)
    .values({
      id,
      name,
      categoryId: null,
      thresholdDays: overrides.thresholdDays ?? null,
      archivedAt: overrides.archivedAt ?? null,
      createdAt: new Date().toISOString(),
    })
    .run()
  return id
}

function addVariant(db: Db, trackerId: string, name: string, thresholdDays: number | null = null): string {
  const id = uuidv7()
  db.insert(variants)
    .values({ id, trackerId, name, thresholdDays, deletedAt: null, createdAt: new Date().toISOString() })
    .run()
  return id
}

function addEntry(db: Db, trackerId: string, occurredAt: string, variantId: string | null = null): void {
  db.insert(entries)
    .values({
      id: uuidv7(),
      trackerId,
      variantId,
      occurredAt,
      durationMinutes: null,
      note: null,
      createdAt: occurredAt,
    })
    .run()
}

function row(label: string, overrides: Partial<LoggableRow> = {}): LoggableRow {
  return { trackerId: 't', variantId: null, label, thresholdDays: null, lastEntryAt: null, ...overrides }
}

describe('loggableRows', () => {
  it('is one row per Tracker when there are no Variants', () => {
    const db = createTestDb()
    addTracker(db, 'vacuuming', { thresholdDays: 7 })

    expect(loggableRows(db)).toEqual([
      expect.objectContaining({ label: 'vacuuming', variantId: null, thresholdDays: 7 }),
    ])
  })

  it('is one row per Variant, and none for the Tracker itself', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure')
    addVariant(db, trackerId, 'volvo')
    addVariant(db, trackerId, 'crv')

    expect(loggableRows(db).map((r) => r.label)).toEqual(['tyre pressure · volvo', 'tyre pressure · crv'])
  })

  it('inherits the parent threshold on a Variant that has none of its own', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure', { thresholdDays: 30 })
    addVariant(db, trackerId, 'volvo')
    addVariant(db, trackerId, 'crv', 60)

    expect(loggableRows(db).map((r) => r.thresholdDays)).toEqual([30, 60])
  })

  it('excludes archived Trackers, which the app hides everywhere', () => {
    const db = createTestDb()
    addTracker(db, 'gone', { archivedAt: '2026-08-01T00:00:00.000Z' })
    addTracker(db, 'here')

    expect(loggableRows(db).map((r) => r.label)).toEqual(['here'])
  })

  it('excludes soft-deleted Variants', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure')
    const soldCar = addVariant(db, trackerId, 'sold car')
    addVariant(db, trackerId, 'volvo')
    db.update(variants)
      .set({ deletedAt: '2026-08-01T00:00:00.000Z' })
      .where(eq(variants.id, soldCar))
      .run()

    expect(loggableRows(db).map((r) => r.label)).toEqual(['tyre pressure · volvo'])
  })

  it('carries the latest Entry for the row, per Variant', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure')
    const volvo = addVariant(db, trackerId, 'volvo')
    addVariant(db, trackerId, 'crv')
    addEntry(db, trackerId, '2026-08-01T00:00:00.000Z', volvo)
    addEntry(db, trackerId, '2026-08-10T00:00:00.000Z', volvo)

    const rows = loggableRows(db)
    expect(rows[0]?.lastEntryAt).toBe('2026-08-10T00:00:00.000Z')
    expect(rows[1]?.lastEntryAt).toBeNull()
  })

  it('does not count a tracker-level Entry as a Variant\'s last-done', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure')
    addVariant(db, trackerId, 'volvo')
    addEntry(db, trackerId, '2026-08-10T00:00:00.000Z', null)

    expect(loggableRows(db)[0]?.lastEntryAt).toBeNull()
  })
})

describe('matchRow', () => {
  const rows = [row('vacuuming'), row('run'), row('running shoes'), row('tyre pressure · volvo'), row('tyre pressure · crv')]

  it('matches a full label exactly', () => {
    expect(matchRow(rows, 'tyre pressure · volvo')).toEqual({ kind: 'one', row: rows[3] })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(matchRow(rows, '  VACUUMING  ')).toEqual({ kind: 'one', row: rows[0] })
  })

  it('prefers an exact name over a longer name that starts with it', () => {
    // "run" is a prefix of "running shoes"; widening straight to prefix would
    // make the shorter Tracker permanently unreachable.
    expect(matchRow(rows, 'run')).toEqual({ kind: 'one', row: rows[1] })
  })

  it('matches on a prefix when nothing is exact', () => {
    expect(matchRow(rows, 'vacu')).toEqual({ kind: 'one', row: rows[0] })
  })

  it('matches on a substring when nothing is a prefix', () => {
    expect(matchRow(rows, 'shoes')).toEqual({ kind: 'one', row: rows[2] })
  })

  it('reports ambiguity rather than guessing — the wrong row is a silent lie', () => {
    const result = matchRow(rows, 'tyre')

    expect(result.kind).toBe('many')
    expect(result.kind === 'many' && result.rows).toHaveLength(2)
  })

  it('finds nothing for text that matches nothing', () => {
    expect(matchRow(rows, 'oil change')).toEqual({ kind: 'none' })
  })

  it('finds nothing for empty text', () => {
    expect(matchRow(rows, '   ')).toEqual({ kind: 'none' })
  })
})

describe('daysSince', () => {
  it('is null when nothing is logged', () => {
    expect(daysSince(null, NOW)).toBeNull()
  })

  it('floors to whole days', () => {
    expect(daysSince('2026-08-20T13:00:00.000Z', NOW)).toBe(1)
  })

  it('clamps a future timestamp to zero rather than going negative', () => {
    expect(daysSince('2026-08-25T00:00:00.000Z', NOW)).toBe(0)
  })
})

describe('slippingRows', () => {
  it('ranks by ratio, not by absolute days', () => {
    const eightOnSeven = row('weekly', { thresholdDays: 7, lastEntryAt: '2026-08-14T12:00:00.000Z' })
    const sixtyOnThirty = row('monthly', { thresholdDays: 30, lastEntryAt: '2026-06-23T12:00:00.000Z' })

    expect(slippingRows([eightOnSeven, sixtyOnThirty], NOW).map((r) => r.label)).toEqual([
      'monthly',
      'weekly',
    ])
  })

  it('leaves out fresh, thresholdless and never-logged rows', () => {
    const fresh = row('fresh', { thresholdDays: 30, lastEntryAt: '2026-08-21T12:00:00.000Z' })
    const thresholdless = row('haircut', { lastEntryAt: '2020-01-01T00:00:00.000Z' })
    const never = row('never', { thresholdDays: 7 })

    expect(slippingRows([fresh, thresholdless, never], NOW)).toEqual([])
  })

  it('includes a due-soon row at 0.8 of its threshold', () => {
    const dueSoon = row('due soon', { thresholdDays: 10, lastEntryAt: '2026-08-14T12:00:00.000Z' })

    expect(slippingRows([dueSoon], NOW)).toHaveLength(1)
  })
})
