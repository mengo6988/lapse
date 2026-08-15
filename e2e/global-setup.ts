/**
 * Wipes the throwaway e2e SQLite directory (data/e2e) so every run of
 * `npm run e2e` boots the real server against an empty database — build
 * ticket 23's smoke suite is worthless if it can pass on a Tracker some
 * earlier run left behind.
 *
 * Where this actually runs is not where you'd expect. Playwright Test lets
 * you register a `globalSetup` file in the config, and the natural reading
 * of that option is "runs before anything else, including `webServer`." It
 * doesn't: @playwright/test 1.62.1's runner builds its setup task list as
 * [removeOutputDirs, ...pluginSetupTasks, ...globalTeardowns, ...globalSetups]
 * (packages/playwright/src/runner/runner.ts, createGlobalSetupTasks), and
 * `webServer` is itself a plugin — its `setup()` spawns the process *and*
 * waits for the health check to pass — so plugin setup runs, and the built
 * server fully boots, before the file wired up via `globalSetup` ever
 * executes. src/server/index.ts's boot opens whatever data/e2e/lapse.db
 * already exists and migrates it in place (migrations are additive, never
 * destructive), so on a second run the server would already be serving
 * last run's Trackers by the time a wipe placed only here fired — this
 * file's own `globalSetup` export would be deleting a directory a live
 * server process already has open, after the damage (a dirty first
 * bootstrap) was done.
 *
 * The fix lives in playwright.config.ts: it imports `wipeE2eDataDir` and
 * calls it at module scope, which Playwright must finish evaluating before
 * it can even read `webServer` back out of the config, let alone start it —
 * so that call is unconditionally the first thing to touch this directory.
 * This file's default export stays wired as the project's `globalSetup`
 * purely so "where's the setup" has a real answer; by the time Playwright
 * calls it, config-time already did the job, so it's a deliberate no-op.
 */
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'

export const E2E_DATA_DIR = path.resolve(import.meta.dirname, '..', 'data', 'e2e')

export function wipeE2eDataDir(): void {
  if (existsSync(E2E_DATA_DIR)) {
    rmSync(E2E_DATA_DIR, { recursive: true, force: true })
  }
}

// Playwright's own `globalSetup` hook — see the header comment for why this
// is intentionally inert by the time Playwright calls it.
export default function globalSetup(): void {
  // no-op: playwright.config.ts already wiped data/e2e at config-load time,
  // strictly before config.webServer could start the server against it.
}
