import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db.js'
import { categories } from './schema.js'

const dirs: string[] = []

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'lapse-db-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true })
})

describe('openDatabase', () => {
  it('creates a migrated database under a data dir that does not exist yet', () => {
    const db = openDatabase(join(tempDir(), 'nested'))

    expect(db.select().from(categories).all()).toEqual([])
  })

  it('applies the durability and integrity pragmas', () => {
    const db = openDatabase(tempDir())

    expect(db.$client.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(db.$client.pragma('busy_timeout', { simple: true })).toBe(5000)
  })

  it('reopens an existing database without losing its rows', () => {
    const dir = tempDir()
    const first = openDatabase(dir)
    first
      .insert(categories)
      .values({ id: 'c1', name: 'car', color: '#f9e2af', createdAt: new Date().toISOString() })
      .run()
    first.$client.close()

    const second = openDatabase(dir)

    expect(second.select().from(categories).all()).toHaveLength(1)
  })
})
