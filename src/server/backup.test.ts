import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupFileName, pruneBackups, runBackupJob, writeBackup } from './backup.js'

function seededDb(): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
  sqlite.prepare('INSERT INTO widgets (name) VALUES (?)').run('left-handed smoke shifter')
  sqlite.prepare('INSERT INTO widgets (name) VALUES (?)').run('sky hook')
  return sqlite
}

describe('backupFileName', () => {
  it('formats as lapse-YYYY-MM-DD.db', () => {
    expect(backupFileName(new Date('2026-08-15T03:00:00Z'))).toBe('lapse-2026-08-15.db')
  })
})

describe('writeBackup', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lapse-backup-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes a dated snapshot that opens as a valid db with the source rows', () => {
    const sqlite = seededDb()

    const path = writeBackup(sqlite, dir, new Date('2026-08-15T03:00:00Z'))

    expect(path).toBe(join(dir, 'lapse-2026-08-15.db'))
    expect(existsSync(path)).toBe(true)

    const restored = new Database(path, { readonly: true })
    const rows = restored.prepare('SELECT name FROM widgets ORDER BY id').all()
    restored.close()

    expect(rows).toEqual([{ name: 'left-handed smoke shifter' }, { name: 'sky hook' }])
  })

  it('creates the backups directory when it does not exist yet', () => {
    const nested = join(dir, 'backups')

    writeBackup(seededDb(), nested, new Date('2026-08-15T00:00:00Z'))

    expect(existsSync(nested)).toBe(true)
  })

  it('overwrites a same-day backup instead of failing on VACUUM INTO of an existing file', () => {
    const sqlite = seededDb()
    const now = new Date('2026-08-15T03:00:00Z')
    writeBackup(sqlite, dir, now)

    sqlite.prepare('INSERT INTO widgets (name) VALUES (?)').run('flux capacitor')
    const path = writeBackup(sqlite, dir, now)

    const restored = new Database(path, { readonly: true })
    const count = restored.prepare('SELECT COUNT(*) as n FROM widgets').get() as { n: number }
    restored.close()

    expect(count.n).toBe(3)
  })

  it('never leaves a stale WAL-mode file copy — VACUUM INTO is a fresh single-file snapshot', () => {
    // regression guard: writeBackup must go through sqlite's VACUUM INTO,
    // not fs.copyFileSync, or a mid-write WAL copy could be corrupt.
    const sqlite = seededDb()
    const path = writeBackup(sqlite, dir, new Date('2026-08-15T03:00:00Z'))

    // a backup taken via VACUUM INTO is a plain rollback-journal-mode
    // single file with no companion -wal/-shm sidecars.
    expect(existsSync(`${path}-wal`)).toBe(false)
    expect(existsSync(`${path}-shm`)).toBe(false)
  })
})

describe('pruneBackups', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lapse-prune-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const touch = (name: string) => writeFileSync(join(dir, name), '')

  it('keeps exactly the newest 7 backups and deletes the rest', () => {
    const names = Array.from({ length: 10 }, (_, i) => `lapse-2026-08-${String(i + 1).padStart(2, '0')}.db`)
    for (const name of names) touch(name)

    const deleted = pruneBackups(dir)
    const remaining = readdirSync(dir).sort()

    expect(remaining).toHaveLength(7)
    expect(remaining).toEqual(names.slice(3)) // the oldest 3 are gone
    expect(deleted.sort()).toEqual(names.slice(0, 3).sort())
  })

  it('is a no-op when there are 7 or fewer backups', () => {
    const names = ['lapse-2026-08-01.db', 'lapse-2026-08-02.db']
    for (const name of names) touch(name)

    const deleted = pruneBackups(dir)

    expect(deleted).toEqual([])
    expect(readdirSync(dir).sort()).toEqual(names)
  })

  it('ignores files in the directory that are not dated backups', () => {
    for (let i = 1; i <= 8; i++) touch(`lapse-2026-08-${String(i).padStart(2, '0')}.db`)
    touch('.gitkeep')
    touch('notes.txt')

    pruneBackups(dir)
    const remaining = readdirSync(dir).sort()

    expect(remaining).toContain('.gitkeep')
    expect(remaining).toContain('notes.txt')
    expect(remaining.filter((name) => name.startsWith('lapse-'))).toHaveLength(7)
  })
})

describe('runBackupJob', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'lapse-job-'))
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('writes today\'s backup under <dataDir>/backups and prunes to 7', () => {
    const backupsDir = join(dataDir, 'backups')
    const preexisting = Array.from({ length: 7 }, (_, i) => `lapse-2026-07-${String(i + 1).padStart(2, '0')}.db`)
    // pre-seed 7 older backups so the new one pushes it to 8 before pruning
    mkdirSync(backupsDir, { recursive: true })
    for (const name of preexisting) writeFileSync(join(backupsDir, name), '')

    const result = runBackupJob(seededDb(), dataDir, new Date('2026-08-15T03:00:00Z'))

    expect(result.path).toBe(join(backupsDir, 'lapse-2026-08-15.db'))
    expect(existsSync(result.path)).toBe(true)

    const remaining = readdirSync(backupsDir)
    expect(remaining).toHaveLength(7)
    expect(remaining).toContain('lapse-2026-08-15.db')
    expect(result.pruned).toHaveLength(1)
  })
})
