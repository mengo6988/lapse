/**
 * Journey 1 (build ticket 23): create a Tracker through the real create
 * sheet, tap it to log, and — the actual point of this journey — reload the
 * page and confirm the row still reads as just-done. The row's optimistic
 * "now" during the 5s undo window (src/client/log/logWindowStore.ts) would
 * pass a weaker version of this test even if the Entry never left the
 * device; only a reload, which throws away that client-side window and
 * every other piece of in-memory state and refetches bootstrap from
 * scratch, proves the write actually reached SQLite.
 *
 * Literal copy this test depends on, beyond what e2e/helpers.ts already
 * lists: none for the row's own read — "0d"/"now" come from
 * src/client/list/formatListRow.ts's day-count fragment, asserted as a
 * fragment rather than the full sentence so a copy-audit pass on the
 * surrounding words ("last done Xd ago · every Yd") can't break this test.
 *
 * Before reloading, this clears IndexedDB (e2e/helpers.ts's
 * `clearPersistedQueryCache` — see its header comment): the app persists
 * its query cache there with a 60s staleTime, so a bare reload can repaint
 * from a stale local snapshot instead of ever asking the server again,
 * which would make this assertion pass or fail for the wrong reason either
 * way.
 */
import { expect, test } from '@playwright/test'
import { clearPersistedQueryCache, createTracker, login, openList } from './helpers'

const TRACKER_NAME = 'e2e create then log'

test('create, tap-log, and stay fresh after reload', async ({ page }) => {
  await login(page)
  await openList(page)
  await createTracker(page, TRACKER_NAME)

  const row = page.getByRole('button', { name: TRACKER_NAME })
  await expect(row).toBeVisible()
  // never logged yet: the day-count reads as the never-logged dash, not a
  // number — confirms this is genuinely the fresh Tracker, pre-log.
  await expect(row).toContainText('—')

  const entryPosted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/api/entries') && response.ok(),
  )
  await row.click()
  await entryPosted

  // checkpoint 1: the tap's own optimistic read, pinned "now" for the 5s
  // undo window regardless of what's actually in the database yet.
  await expect(row).toContainText('now')

  // checkpoint 2, the point of this journey: force bootstrap to be
  // refetched from the server rather than repainted from a persisted local
  // snapshot, then reload — a row that still reads fresh here can only be
  // reading it from the server.
  await clearPersistedQueryCache(page)
  await page.reload()
  await expect(row).toContainText('0d')
})
