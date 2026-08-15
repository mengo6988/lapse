/**
 * Journey 3 (build ticket 23): archive a Tracker and confirm it leaves the
 * main list and shows up in the archived view reached from settings
 * (docs/design.md § Archived/Settings, § Navigation: "archived is entered
 * from settings").
 *
 * Archive itself only lives in the edit-Tracker sheet (docs/design.md §
 * Create/Edit Tracker: "archive action (edit mode)"), which is reached from
 * the Tracker detail screen, which is reached by revealing a list row's
 * swipe-left "details" action. This test reaches "details" via `.focus()`
 * rather than a real swipe: src/client/detail/SwipeRevealRow.tsx wires
 * `onFocus={swipe.reveal}` on that button specifically so it's reachable
 * without a gesture at all ("the details button is a real, always-mounted
 * <button> — reachable by Tab/screen readers with no gesture at all"). The
 * swipe gesture itself already has direct unit coverage
 * (src/client/detail/useSwipeReveal.test.ts); this journey only needs the
 * outcome of archiving to be true end-to-end, not a second exercise of the
 * gesture math.
 *
 * Literal copy this test depends on, beyond e2e/helpers.ts's list: "details"
 * (SwipeRevealRow's default action label), "edit" (detail screen header
 * button), "archive" (both the trigger and, after confirming, the confirm
 * button — src/client/tracker/ArchiveSection.tsx), "back" (detail screen
 * header), "settings" and "archived" (tab bar / settings' link to
 * src/client/routes/SettingsRoute.tsx).
 */
import { expect, test } from '@playwright/test'
import { createTracker, login, openList } from './helpers'

const TRACKER_NAME = 'e2e archive me'

test('archiving a Tracker removes it from the list and surfaces it in archived', async ({ page }) => {
  await login(page)
  await openList(page)
  await createTracker(page, TRACKER_NAME)

  const row = page.getByRole('button', { name: TRACKER_NAME })
  await expect(row).toBeVisible()

  const listItem = page.getByRole('listitem').filter({ has: row })
  const detailsButton = listItem.getByRole('button', { name: 'details' })
  await detailsButton.focus()
  await detailsButton.click()

  await expect(page.getByRole('heading', { level: 1, name: TRACKER_NAME })).toBeVisible()
  await page.getByRole('button', { name: 'edit' }).click()

  const editSheet = page.getByRole('dialog', { name: 'edit tracker' })
  await expect(editSheet).toBeVisible()
  await editSheet.getByRole('button', { name: 'archive' }).click()
  await editSheet.getByRole('button', { name: 'archive' }).click()
  await expect(editSheet).toBeHidden()

  // "back" (docs/design.md § Navigation: depth-2 screens carry their own
  // back affordance) always returns to /list, so no extra tab click needed.
  await page.getByRole('button', { name: 'back' }).click()
  await expect(page.getByRole('button', { name: TRACKER_NAME })).toHaveCount(0)

  await page.getByRole('link', { name: 'settings' }).click()
  await page.getByRole('link', { name: 'archived' }).click()

  const archivedSection = page.getByRole('region', { name: 'archived' })
  await expect(archivedSection.getByText(TRACKER_NAME, { exact: true })).toBeVisible()
})
