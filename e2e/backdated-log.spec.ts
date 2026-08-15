/**
 * Journey 2 (build ticket 23): a long-press opens the log sheet
 * (src/client/log/useLongPress.ts, 450ms threshold; docs/design.md § Log
 * sheet), and logging with a picked time other than now has to actually
 * land at that time rather than the moment the press fired.
 *
 * The row's *count* can't be what this asserts: it's pinned to "now" for
 * the whole 5s undo window regardless of what was actually logged — the
 * freeze (src/client/log/logWindowStore.ts) only pins which slot a row sits
 * in and its settle animation, never the underlying data. This asserts the
 * row's subline instead, which src/client/list/formatListRow.ts's
 * `formatRowSubline` computes from live data even mid-window (only the
 * ListRowItem's separate count span gets the "now" override — see
 * src/client/list/ListRowItem.tsx).
 *
 * "yesterday" rather than "1h ago": src/client/domain/daysAgo.ts buckets by
 * local calendar day, so a chip exactly 24h in the past always lands one
 * calendar day back regardless of what time of day the suite happens to
 * run. "1h ago" would read as one day back only before local midnight and
 * as today otherwise — exactly the kind of clock-dependent flake this
 * choice avoids.
 *
 * Literal copy this test depends on, beyond e2e/helpers.ts's list: "log
 * entry" (log sheet dialog title, src/client/log/LogSheetHost.tsx),
 * "yesterday" (time chip), "log" (sheet submit button) —
 * src/client/log/LogSheet.tsx.
 *
 * Before reloading, this clears IndexedDB (e2e/helpers.ts's
 * `clearPersistedQueryCache`): the app persists its query cache there with
 * a 60s staleTime, so a bare reload can repaint from a stale local
 * snapshot instead of asking the server again — see that helper's header
 * comment.
 */
import { expect, test } from '@playwright/test'
import { clearPersistedQueryCache, createTracker, login, longPress, openList } from './helpers'

const TRACKER_NAME = 'e2e backdated log'

test('a backdated long-press log reflects the picked time, not the press', async ({ page }) => {
  await login(page)
  await openList(page)
  await createTracker(page, TRACKER_NAME)

  const row = page.getByRole('button', { name: TRACKER_NAME })
  await expect(row).toBeVisible()
  await longPress(row)

  const sheet = page.getByRole('dialog', { name: 'log entry' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'yesterday' }).click()

  const entryPosted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/api/entries') && response.ok(),
  )
  await sheet.getByRole('button', { name: 'log', exact: true }).click()
  await entryPosted
  await expect(sheet).toBeHidden()

  await expect(row).toContainText('last done 1d ago')

  // and it's the server's own record of the backdated time, not a
  // client-only artefact of the optimistic write above.
  await clearPersistedQueryCache(page)
  await page.reload()
  await expect(row).toContainText('last done 1d ago')
})
