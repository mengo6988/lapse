import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db.js'

export const BACKUPS_KEPT = 7
const FILE_PREFIX = 'lapse-'
const FILE_SUFFIX = '.db'

/** `lapse-YYYY-MM-DD.db`, per docs/tech-stack.md § Ops. */
export function backupFileName(now: Date): string {
  const date = now.toISOString().slice(0, 10)
  return `${FILE_PREFIX}${date}${FILE_SUFFIX}`
}

/**
 * Writes one consistent snapshot with `VACUUM INTO`. This is deliberately
 * not a filesystem copy of the live db file: in WAL mode the live file can
 * be mid-write, so a raw copy risks capturing a torn, corrupt snapshot.
 * `VACUUM INTO` asks SQLite itself for a transactionally consistent copy.
 *
 * `VACUUM INTO` refuses to write to a path that already exists, which would
 * otherwise throw on every second boot within the same day (a restart after
 * today's backup already ran); removing any stale same-day file first turns
 * that into an overwrite with the freshest snapshot instead of a crash.
 */
export function writeBackup(sqlite: Db['$client'], backupsDir: string, now: Date = new Date()): string {
  mkdirSync(backupsDir, { recursive: true })
  const path = join(backupsDir, backupFileName(now))

  if (existsSync(path)) {
    rmSync(path)
  }
  sqlite.prepare('VACUUM INTO ?').run(path)

  return path
}

/** True for filenames this module writes — guards prune from touching anything else in the directory. */
function isBackupFile(name: string): boolean {
  return name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX)
}

/**
 * Deletes all but the newest `keep` backups. Filenames sort lexically in
 * the same order as chronologically (YYYY-MM-DD), so a plain string sort is
 * enough to find the oldest ones — no need to parse dates back out.
 */
export function pruneBackups(backupsDir: string, keep: number = BACKUPS_KEPT): string[] {
  const backups = readdirSync(backupsDir).filter(isBackupFile).sort()
  const excess = Math.max(0, backups.length - keep)
  const toDelete = backups.slice(0, excess)

  for (const name of toDelete) {
    rmSync(join(backupsDir, name))
  }

  return toDelete
}

export type BackupJobResult = {
  path: string
  pruned: string[]
}

/**
 * One backup cycle: write, then prune. Kept pure of any timer or process
 * concerns so it can be called directly in tests without waiting on a
 * schedule — see backupSchedule.ts for the in-process interval that calls
 * this daily.
 */
export function runBackupJob(sqlite: Db['$client'], dataDir: string, now: Date = new Date()): BackupJobResult {
  const backupsDir = join(dataDir, 'backups')
  const path = writeBackup(sqlite, backupsDir, now)
  const pruned = pruneBackups(backupsDir)
  return { path, pruned }
}
