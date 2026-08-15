/**
 * Build ticket 23's smoke suite: three journeys driven against the actual
 * production build (`npm run build`), served by the real Hono server
 * (`npm start`, src/server/index.ts — no dev server, no mocked API), on a
 * throwaway SQLite file under data/e2e. This file's only job is wiring
 * those pieces together; the journeys themselves live under e2e/.
 *
 * `wipeE2eDataDir()` runs below, synchronously, at module scope — see
 * e2e/global-setup.ts's header comment for why that's load-bearing rather
 * than decorative: Playwright's own `globalSetup` option (also wired below)
 * fires *after* `webServer` has already booted the server against whatever
 * was left on disk, so it can't be what actually guarantees a fresh
 * database. This call, happening while Playwright is still loading this
 * config file, is what does.
 */
import { defineConfig, devices } from '@playwright/test'
import { wipeE2eDataDir } from './e2e/global-setup'

wipeE2eDataDir()

export const E2E_PORT = 4488
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`
// An obvious throwaway: this only ever guards a database this same run just
// wiped, on a port nothing else uses.
export const E2E_PASSWORD = 'lapse-e2e-throwaway-password'
const E2E_DATA_DIR = 'data/e2e'

export default defineConfig({
  testDir: './e2e',
  // Playwright's default output dir (test-results/) is at the repo root and
  // isn't git-ignored — this suite isn't allowed to add an ignore entry
  // (see the ticket's file fence), so failure artifacts (traces,
  // screenshots) are redirected under data/, which already is.
  outputDir: 'data/e2e-test-results',
  // The server, database, and browser are all shared across the whole run;
  // three journeys buy nothing from parallel workers beyond a second axis
  // of things that could flake, so this suite runs strictly sequentially.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,

  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Chromium only, at a mobile viewport (docs/design.md § Feel: "Mobile-
  // first layout ... usable at desktop width but not optimised for it").
  // Pixel 7 rather than one of Playwright's iPhone presets: those default
  // to WebKit, and the ticket calls for Chromium specifically — Pixel 7
  // still gets a real mobile viewport plus touch affordances (isMobile /
  // hasTouch) and a phone-class user agent, just on the Chromium engine.
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],

  globalSetup: './e2e/global-setup.ts',

  webServer: {
    command: 'npm run build && npm start',
    url: E2E_BASE_URL,
    // Never reuse a server left over from something else: this suite owns
    // starting and stopping it, on a database it just wiped, every time.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(E2E_PORT),
      DATA_DIR: E2E_DATA_DIR,
      LAPSE_PASSWORD: E2E_PASSWORD,
    },
  },
})
