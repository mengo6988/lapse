import { runBackupJob } from './backup.js'
import type { Db } from './db.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Runs the backup job now, then once per `intervalMs` (a day, by default) —
 * an in-process `setInterval`, no cron dependency, per docs/tech-stack.md §
 * Ops. Called once from the boot sequence in index.ts.
 *
 * A failed backup is logged loudly but never rethrown: a running app with a
 * stale or missing backup is better than a server that won't boot because
 * disk was briefly full.
 */
export function scheduleBackups(sqlite: Db['$client'], dataDir: string, intervalMs: number = DAY_MS): NodeJS.Timeout {
  function run(): void {
    try {
      const result = runBackupJob(sqlite, dataDir)
      console.log(`backup written: ${result.path}`)
    } catch (error) {
      console.error('backup failed:', error instanceof Error ? error.message : error)
    }
  }

  run()
  return setInterval(run, intervalMs)
}
