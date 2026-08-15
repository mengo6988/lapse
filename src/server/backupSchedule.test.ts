import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleBackups } from './backupSchedule.js'

function seededDb(): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
  return sqlite
}

describe('scheduleBackups', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'lapse-schedule-'))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T02:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('runs a backup immediately on boot, without waiting for the interval', () => {
    const timer = scheduleBackups(seededDb(), dataDir, 24 * 60 * 60 * 1000)
    clearInterval(timer)

    const backupsDir = join(dataDir, 'backups')
    expect(readdirSync(backupsDir)).toEqual(['lapse-2026-08-15.db'])
  })

  it('runs again once the interval elapses, producing the next day\'s file', () => {
    const dayMs = 24 * 60 * 60 * 1000
    const timer = scheduleBackups(seededDb(), dataDir, dayMs)

    vi.advanceTimersByTime(dayMs)
    clearInterval(timer)

    const backupsDir = join(dataDir, 'backups')
    expect(readdirSync(backupsDir).sort()).toEqual(['lapse-2026-08-15.db', 'lapse-2026-08-16.db'])
  })

  it('logs and does not throw when the backup job fails, so the server keeps running', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const brokenSqlite = {
      prepare: () => {
        throw new Error('disk full')
      },
    } as unknown as Database.Database

    let timer: NodeJS.Timeout | undefined
    expect(() => {
      timer = scheduleBackups(brokenSqlite, dataDir, 24 * 60 * 60 * 1000)
    }).not.toThrow()
    if (timer) clearInterval(timer)

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('backup failed'), expect.anything())
    errorSpy.mockRestore()
  })

  it('logs a non-Error throw value as-is', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const brokenSqlite = {
      prepare: () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'disk full'
      },
    } as unknown as Database.Database

    const timer = scheduleBackups(brokenSqlite, dataDir, 24 * 60 * 60 * 1000)
    clearInterval(timer)

    expect(errorSpy).toHaveBeenCalledWith('backup failed:', 'disk full')
    errorSpy.mockRestore()
  })
})
