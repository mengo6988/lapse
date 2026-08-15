/**
 * Shared driving code for the smoke suite (build ticket 23): logging in
 * through the real password gate, creating a Tracker through the real
 * create sheet, and synthesising the 450ms long-press gesture. Every
 * journey but the archive one starts with login-then-create, and the
 * archive journey needs a Tracker to archive in the first place — pulling
 * this into one module means a copy change to the login form or the create
 * sheet only has to be re-taught to one place, not three spec files.
 *
 * Deliberately thin: nothing here asserts anything beyond "did the step
 * that was requested actually happen" (the sheet closed, the dialog opened).
 * A helper that asserted on the journeys' own behalf would hide a broken
 * step behind a passing helper call.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { E2E_PASSWORD } from '../playwright.config'

/**
 * Logs in through src/client/shell/LoginScreen.tsx and waits for the tabbed
 * shell to replace it. The tab bar's "list" link is the wait target rather
 * than anything on the login form itself: it only exists once
 * src/client/shell/AppShell.tsx has swapped session state from
 * 'unauthorized' to 'authed', which is the actual precondition every
 * journey here depends on.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'log in' }).click()
  await expect(page.getByRole('link', { name: 'list' })).toBeVisible()
}

/** Switches to the List tab (docs/design.md § List) — every journey below asserts against a list row rather than the home digest, since a fresh Tracker's home placement depends on the digest's own selection rules (top-3 slipping, top-6 quick-log) while List always shows every active row. */
export async function openList(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'list' }).click()
}

/**
 * Drives the centre FAB → create sheet → save path (docs/design.md §
 * Create/Edit Tracker: "Name field focused on open — type name, hit save,
 * done"). Only fills the name field, matching the minimum-viable-add the
 * design doc describes — Category/Threshold/Variants stay collapsed and
 * untouched, which is itself part of what this suite is proving works.
 * Waits for the sheet to close, which only happens in TrackerForm's
 * `onSuccess` — i.e. once the server has accepted POST /api/trackers — so a
 * caller can rely on the Tracker already being in the bootstrap cache the
 * moment this resolves.
 */
export async function createTracker(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'new tracker' }).click()
  const sheet = page.getByRole('dialog', { name: 'new tracker' })
  await sheet.getByLabel('name', { exact: true }).fill(name)
  await sheet.getByRole('button', { name: 'add tracker' }).click()
  await expect(sheet).toBeHidden()
}

/**
 * Synthesises the 450ms long-press gesture src/client/log/useLongPress.ts
 * listens for, via `pointerdown` → hold → `pointerup` dispatched straight at
 * the target element rather than through `page.mouse`.
 *
 * That choice is deliberate, not a shortcut: a long-press's whole point is
 * that *something new mounts on screen while the pointer is still down* (the
 * log sheet's full-viewport scrim, src/client/tracker/trackerSheet.css's
 * `.tracker-sheet-scrim { position: fixed; inset: 0 }`, appears mid-hold,
 * directly over the row). `page.mouse.up()` is a real hit-tested input event
 * — with the scrim now covering that screen position, the browser would
 * synthesise the follow-up `click` against *the scrim*, not the row, and the
 * scrim's own `onClick` closes the sheet this same gesture just opened,
 * before a test ever gets to touch it. Dispatching `pointerup` straight at
 * the originally-pressed element (Locator.dispatchEvent, still one of
 * Playwright's own pointer APIs) sidesteps that hit-test entirely — and
 * costs nothing, because the production gesture doesn't need a synthesised
 * `click` afterward either: useLongPress's `shouldSuppressClick()` exists
 * precisely to make the click a no-op once a long-press has already fired.
 */
export async function longPress(target: Locator, holdMs = 600): Promise<void> {
  await target.dispatchEvent('pointerdown', { pointerId: 1, bubbles: true, cancelable: true })
  await target.page().waitForTimeout(holdMs)
  await target.dispatchEvent('pointerup', { pointerId: 1, bubbles: true, cancelable: true })
}

/**
 * Wipes every IndexedDB database for the origin. A bare `page.reload()`
 * alone is *not* proof an Entry reached SQLite in this app: src/client/
 * query/persister.ts persists the whole bootstrap query to IndexedDB
 * (docs/tech-stack.md § Offline-lite), and src/client/query/client.ts's 60s
 * `staleTime` means `useBootstrapQuery` treats a restored snapshot as fresh
 * enough to skip refetching. A reload run within that window would repaint
 * straight from whatever was last persisted — which reflects the
 * *client's* optimistic write (queryClient.setQueryData in
 * src/client/log/useLogRow.ts runs before the network call, not after), not
 * necessarily the server's. Clearing IndexedDB first leaves
 * `useBootstrapQuery` nothing to restore, so the next mount's read is
 * unambiguously a fresh fetch answered by the real server.
 */
export async function clearPersistedQueryCache(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases()
    await Promise.all(
      databases
        .filter((db): db is IDBDatabaseInfo & { name: string } => typeof db.name === 'string')
        .map(
          (db) =>
            new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(db.name)
              request.onsuccess = () => resolve()
              request.onerror = () => resolve()
              request.onblocked = () => resolve()
            }),
        ),
    )
  })
}
