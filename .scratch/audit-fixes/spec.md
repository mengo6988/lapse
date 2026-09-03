# Spec: Audit fixes — the 2026-09-02 review findings

**Status:** resolved — all nine decisions shipped in `ba8df9f..0a2af89`

Source: the implementation review run on 2026-09-02 (three review agents, every finding reproduced by a throwaway test before it made the list). This spec covers every fix from that review. Findings judged not worth fixing are listed under Out of Scope with the reason.

## Problem Statement

Lapse works, and 926 tests say so. But a handful of edges bite the one person who uses it:

- One request that never settles (a flaky cellular hop, a proxy that swallows the connection) freezes the outbox. Every later drain trigger is turned away because the previous pass never released its lock. Queued Entries sit there until the app is force-closed and reopened, and the pending chip gives no hint why "retry all" does nothing.
- Deleting an Entry from the edit sheet while offline fails with a toast, although logging and undo both survive being offline. The tech-stack contract says `DELETE /entries/:id` is in outbox scope; the edit sheet doesn't honour it.
- A deploy is invisible to the installed PWA on iOS. The Cache-Control header the update strategy depends on is only sent for the literal paths `/sw.js` and `/index.html`, and a real page load never asks for either. It asks for `/` or a deep link, both served by the SPA fallback with no header.
- A typo'd or removed API route returns the HTML shell with status 200. Shortcuts and the Telegram bot see "success" with an HTML body.
- On a cold start with no persisted cache, Home says `nothing slipping` and List says `nothing here yet — add your first tracker` for the half-second before bootstrap resolves. If bootstrap fails outright, the same empty copy stays up, indistinguishable from an account with no Trackers.
- Activity can say `nothing logged yet` while Entries exist, whenever the entries page resolves before bootstrap has (rows whose Tracker isn't loaded yet are dropped).
- The hard-delete and category-delete dialogs trap keyboard focus but leave the page behind them readable and reachable to a screen reader. The other two overlays in the app portal to `body` and mark siblings inert; these two don't.
- A custom Threshold over ten years round-trips to a server 400 instead of an inline field error.
- Small drift: Entry meta text in Detail is set in the serif face where the design doc says mono. The list search box is a plain text input, so iOS shows the wrong keyboard and no clear button. The exit-animation duration is a hardcoded number in a hook and a token in CSS with nothing keeping them equal. Five live UI strings are missing from the canonical copy table.
- Defensive gaps on the server: a `POST /trackers` or `POST /trackers/:id/variants` that reuses a client id throws an uncaught primary-key error (500); a `POST /entries` replay whose id matches an existing Entry under a different Tracker silently returns the old row. The Telegram poll has a shutdown signal but no client-side deadline.

## Solution

Fix each one at the narrowest seam that covers every caller. Nothing here adds a module the app doesn't already have a slot for.

1. Every client request gets a deadline. Timing out is a network failure like any other, so the outbox backs off and retries exactly as it would for a dropped connection, and the drain lock is always released.
2. The edit sheet's delete goes through the outbox like undo does. Offline, the Entry disappears from history and the pending chip counts one more queued write.
3. The server sets `Cache-Control: max-age=0, must-revalidate` on every response that is the app shell or the service worker, whatever path was asked for.
4. Unknown `/api/*` paths return a JSON 404.
5. Home, List and Activity distinguish loading, failed, and empty. Cached data still shows through a failed refetch.
6. The two delete dialogs portal and set the background inert like the other overlays.
7. The custom Threshold field rejects amounts over ten years before the request is sent.
8. Small drift fixed in place, and the copy table catches up with the strings that exist.
9. The server answers a reused client id with 409 and a Tracker-mismatched Entry replay with 409. The Telegram poll gets a client deadline.

## User Stories

1. As the user, I want a request that never settles to give up after a bounded wait, so that one bad connection can't stall the app until I force-close it.
2. As the user, I want a timed-out queued Entry to retry on the normal backoff, so that a flaky moment costs a delay and not the Entry.
3. As the user, I want "retry all" in the queued sheet to actually start a pass after a timeout, so that the button does what it says.
4. As the user, I want a timed-out request to count as offline, not as a server rejection, so that it never dead-letters a write the server hasn't seen.
5. As the user, I want a timed-out read (bootstrap, history, activity) to show the same failed state a dropped connection would, so that the screen is never stuck on a spinner.
6. As the user, I want to delete an Entry from the edit sheet while offline and have it go through, so that history edits survive the garage the same way logging does.
7. As the user, I want the deleted Entry to vanish from the history list immediately, so that the screen reflects what I did without waiting on the network.
8. As the user, I want the queued delete to appear in the pending chip and queued sheet, so that I can see it hasn't landed yet.
9. As the user, I want a queued delete to send after the queued create for the same Entry, so that the server never sees a delete for an Entry it hasn't received.
10. As the user, I want deleting an Entry that is still waiting in the queue to drop the queued create outright, so that nothing pointless is sent.
11. As the user, I want the Tracker's "last done" to refresh after a delete lands, so that Home doesn't keep showing a time that no longer exists.
12. As the user, I want a deploy to reach my installed PWA on the next open, so that I never run a stale bundle on iOS.
13. As the user, I want deep links and the root path to carry the same no-cache header as the shell, so that the update rule holds for every way the app gets loaded.
14. As the user, I want the service worker script itself to be revalidated on every fetch, so that the browser's update check finds the new version.
15. As a Shortcuts or bot author, I want an unknown API path to return a JSON 404, so that a typo fails loudly instead of returning the HTML shell as success.
16. As a Shortcuts or bot author, I want an unauthenticated request to an unknown API path to still return 401, so that route existence isn't leaked before auth.
17. As the user, I want Home to show a loading state on a cold start, so that I never read `nothing slipping` about data that hasn't arrived.
18. As the user, I want Home to say bootstrap failed when it did and there's nothing cached, so that I know to try again rather than believing I have no Trackers.
19. As the user, I want Home to keep showing cached Trackers when a background refetch fails, so that a failed refresh doesn't blank a screen that had data.
20. As the user, I want List to behave the same way as Home for loading and failure, so that the two screens don't disagree about the same query.
21. As the user, I want Activity to wait for both bootstrap and the entries page before declaring `nothing logged yet`, so that a race between two requests can't tell me my history is empty.
22. As the user, I want Activity to show its failed state if bootstrap fails and nothing is cached, so that an empty screen always has a reason on it.
23. As a screen-reader user, I want the hard-delete confirmation to be the only thing reachable while it's open, so that I can't drift into the archived list behind it.
24. As a screen-reader user, I want the category-delete confirmation to behave the same way, so that every dialog in the app is modal in the same sense.
25. As a keyboard user, I want the two dialogs to keep restoring focus to the control that opened them when they close, so that the accessibility fix doesn't cost the existing focus contract.
26. As the user, I want the custom Threshold field to tell me inline when the amount is over ten years, so that I don't get a generic save failure for a value I can see.
27. As the user, I want the custom Threshold cap to match the server's cap exactly, so that anything the field accepts the server accepts.
28. As the user, I want Entry meta text in Detail to use the same mono face as every other timestamp, so that the ledger look holds on that screen.
29. As the user, I want the list search box to open the search keyboard on iOS with a clear button, so that clearing a filter is one tap.
30. As the developer, I want a test that fails when the exit-animation duration in the hook and the fade token in CSS disagree, so that the two can't drift.
31. As the developer, I want every live UI string to be in the canonical copy table, so that the next copy change has one list to check.
32. As a Shortcuts author, I want reusing a Tracker or Variant client id to answer 409, so that a retried create tells me what happened instead of failing with a 500.
33. As a Shortcuts author, I want an Entry replay whose id belongs to a different Tracker to answer 409, so that a client bug is visible instead of silently returning someone else's row.
34. As the operator, I want the Telegram long poll to give up client-side a little after Telegram's own timeout, so that a dead socket can't hang the bot loop.
35. As the operator, I want a Telegram send to have a short deadline, so that one stuck reply can't block the loop from answering the next message.
36. As the developer, I want each fix to arrive with the test that reproduced the bug, so that the review's throwaway tests become permanent.

## Implementation Decisions

### 1. Request deadline (client)

- The single fetch wrapper the client uses for every API call owns the deadline. Nothing else in the client calls fetch directly, so this is one change for every caller.
- A timed-out request throws the wrapper's existing error type with a null status, the same shape a dropped connection produces. The outbox already classifies null-status errors as retryable, so no outbox code changes for this fix.
- The deadline merges with any signal a caller already passes, rather than replacing it.
- Default deadline is 15 seconds. It is a module constant, not configuration.
- jsdom's AbortSignal may lack the `timeout` and `any` statics that Node has. If the client test project can't see them, use a timer plus an AbortController rather than polyfilling.

### 2. Edit-sheet delete through the outbox (client)

- The delete hook used by the edit sheet stops going through the generic fail-fast write interface and instead calls the outbox's queue-then-send delete, the same function undo uses.
- The hook keeps its cache responsibilities: remove the Entry from the loaded history pages immediately, and mark bootstrap stale so the Tracker's `latestEntry` is refetched from the server. These happen before the send, since the send may not complete for hours.
- The outbox's existing rules carry over unchanged: a delete queued behind a still-pending create for the same id drops the create instead; the serial drain keeps create ahead of delete; a 4xx dead-letters.
- The edit sheet's success path no longer waits on the network. It closes once the cache is updated and the write is queued or sent.
- This contradicts the wording of ADR-0002's 2026-08-15 amendment ("Outbox scope confirmed as `POST /entries` only"). The tech-stack contract has since widened scope to include `DELETE /entries/:id` (build ticket 17) and the ADR text is stale. Append a one-line amendment to ADR-0002 noting the widened scope and pointing at the tech-stack section, rather than leaving the two in disagreement.

### 3. Cache-Control on the shell and worker (server)

- The header is decided by what is being served, not by what path was asked for. One middleware, registered before the static handlers, sets `Cache-Control: max-age=0, must-revalidate` after the response when the path is the service worker script or the response is HTML.
- Static serving moves out of the boot script and into a small function the app factory can call, so the app under test can serve a temporary client directory and the header can be asserted through the same request interface the API tests use. The boot script keeps the existence check and the "client not built yet" fallback.

### 4. JSON 404 for unknown API paths (server)

- Inside the app factory, after the four API route mounts, a catch-all for `/api/*` returns `{ error: 'not found' }` with status 404.
- It sits after the auth middleware, so an unauthenticated request to an unknown path still answers 401. That is the existing behaviour for known paths and it should not differ for unknown ones.
- The SPA fallback needs no change once the catch-all exists, because nothing under `/api` reaches it.

### 5. Loading, failed, and empty on Home, List, Activity (client)

- The rule, applied identically on all three: if data is present, render it (even if the query is also in error from a failed refetch). If data is absent and the query is pending, render `loading…`. If data is absent and the query is in error, render the failed-state copy. Only when data is present and empty does the empty copy render.
- Home and List currently read only `data` from the bootstrap query. They read status as well.
- Activity additionally gates its empty state on bootstrap having data, since its row builder drops Entries whose Tracker isn't loaded. While bootstrap is pending Activity shows `loading…`; if bootstrap errors with nothing cached it shows its existing failed-state copy.
- New canonical strings: Home and List share `couldn't load trackers — try again` for the failed state, and every screen uses `loading…` for the pending state (Activity already does). Both strings are added to the copy table.
- The persisted query cache means a returning user almost never sees these states. They exist for first install, a cleared cache, and an outright server failure.

### 6. Dialogs portal and inert (client)

- Hard-delete and category-delete dialogs render through a portal to `body` and call the existing inert-background hook, exactly as the queued sheet and the entry-edit sheet already do.
- Focus trap and focus restoration stay as they are.

### 7. Custom Threshold cap (client)

- The custom-input conversion that already returns null for a non-positive amount also returns null when the resulting days exceed 3650, the server's cap.
- Today the picker silently ignores a null result and leaves the value unchanged, so an over-cap amount looks like a tap that did nothing. The picker shows the form's existing inline field error for a null result instead, with the string `up to 10 years` (added to the copy table). The same error covers the non-positive case, which was silent before too.
- The cap is one shared constant on the client. The server keeps its own; a test on the server side asserts the same number so the two can't drift without a failing test.

### 8. Drift and copy

- Entry meta in Detail switches from the serif to the mono font token.
- The list search input becomes `type="search"`. Its accessible role changes from textbox to searchbox; the existing List tests that query by role update accordingly.
- The exit-transition hook keeps its constant. A test reads the CSS tokens file and asserts the fade token equals that constant in milliseconds. No runtime coupling.
- Copy table additions, in the design doc's existing format: `today` (Home, Activity day header, Detail history, all three already emit it), `nothing queued` (queued sheet, empty), `delete forever` (hard-delete confirm), `delete entry` (edit sheet delete), `up to 10 years` (custom Threshold over the cap, decision 7), and the two new loading and failed strings from decision 5.

### 9. Server defensive gaps

- Tracker and Variant creates catch a primary-key conflict on the client-supplied id and answer 409 with `{ error: 'id already exists' }`, alongside the foreign-key catch they already have.
- Entry create's idempotency short-circuit compares the existing row's Tracker to the request's. A match returns the existing row as today; a mismatch answers 409 with `{ error: 'id belongs to another tracker' }`.
- The Telegram API caller takes a deadline in milliseconds and merges it with the shutdown signal. `getUpdates` passes Telegram's long-poll timeout plus 10 seconds; `sendMessage` passes 10 seconds. An abort surfaces as the module's existing error type so the bot loop's retry behaviour is unchanged.

## Testing Decisions

A good test here drives the app through a seam it already has and asserts what the user or the API caller would observe. It never asserts that a flag was set or a function was called.

Seams, all existing:

- **Server: the app factory driven by `app.request()`.** Every server route test already works this way with an in-memory database. The 404, 409, and Cache-Control tests all go through it. Cache-Control needs the factory to serve a temporary directory containing an `index.html` and `sw.js`; that is the only new affordance, and it's an option on the existing factory.
- **Server: stubbed global fetch for the Telegram caller.** The Telegram API tests already stub fetch and inspect the request init. The deadline test uses fake timers and asserts the init's signal aborts, once for the long poll and once for a send.
- **Client: stubbed global fetch under the fetch wrapper and the outbox.** The wrapper's tests and the outbox tests already stub fetch, including a never-resolving variant. The timeout test asserts the wrapper rejects with a null-status error after the deadline under fake timers. The outbox test queues two Entries with the first fetch hanging, advances past the deadline, and asserts the second is attempted and the first has an attempt count of 1.
- **Client: hook tests under a real QueryClient for the delete hook.** Its existing test renders the hook in a provider. The new test stubs fetch as offline and asserts the Entry is gone from the history cache, bootstrap is marked stale, and the outbox store holds one delete record. A second test queues a create for the same id first and asserts the create is dropped and no delete is queued.
- **Client: route tests that seed the query cache.** Home, List, and Activity route tests already render inside a QueryClient with fixture data set directly. The new tests render with nothing seeded and fetch stubbed to hang (asserts `loading…`, no empty copy), to reject (asserts the failed copy), and with stale data seeded plus a rejecting refetch (asserts the data still renders). Activity gets one more: entries seeded, bootstrap pending, asserts no `nothing logged yet`.
- **Client: dialog component tests.** The queued sheet's test already asserts portal placement and inert siblings. Copy that shape into the two dialog tests.
- **Client: pure-function tests for the Threshold conversion and the token check.** The conversion module has a unit test file; add the over-cap case. The exit-transition test file gets the token-equality test.

Prior art by module: `app.test.ts` and `routes/trackers.test.ts` (server request tests), `telegram/api.test.ts` (fetch stub with init inspection), `api/client.test.ts` and `outbox/entryOutbox.test.ts` (client fetch stubs), `detail/useDeleteEntry.test.tsx` (hook under a provider), `routes/HomeRoute.test.tsx` (seeded cache), `outbox/QueuedSheet.test.tsx` (portal and inert), `tracker/thresholdPresets.test.ts`.

Coverage: the global 80% rule holds. Each fix lands with its reproducing test; the review's throwaway tests are the starting point and were deleted, so they are rewritten rather than restored.

## Out of Scope

- **Entries logged against a soft-deleted Variant.** The server accepts them. Rejecting would dead-letter an outbox replay for a Variant removed while the write was queued, which is the same reason archived Trackers accept Entries. Left as is. If it's ever changed, it's a product decision, not a bug fix.
- **Starter Trackers on an empty Home.** Promised by the design doc, not built, already tracked as improvements-backlog issue 02 and waiting on a yes from the user.
- **Retrying the still-in-flight request when the deadline fires.** The outbox's existing backoff handles the retry. No separate retry inside the fetch wrapper.
- **Making the deadline configurable.** A constant is enough for one user.
- **The `'unknown'` session flash in the app shell on first paint.** Cosmetic and brief; not in this batch.
- **Retiring the two dead log-failure constants** noted in the design doc's copy section. Separate cleanup.

## Further Notes

- The two server static-serving fixes (Cache-Control, API 404) are the only ones that touch the boot path. Moving static serving into a factory-callable function is what makes them testable; keep the moved code the same shape as the existing static handlers, only relocated.
- Decision 2 changes when the edit sheet closes (immediately, not after the network). Check the sheet's existing test for an assertion that it waits on the response and update it deliberately rather than by accident.
- The design doc's copy rule uses an em-dash inside UI strings. Keep that for the new strings; the rule is about UI copy, not prose.
- Order of work if one agent does the lot: 1 (deadline) and 2 (delete through outbox) first since they share the outbox tests, then 3 and 4 together since they share the factory change, then the rest in any order.

## Answer

Eight commits, `ba8df9f..0a2af89`. Every decision shipped with the test that reproduces its bug; 961 tests green, typecheck clean, coverage 98.13%, the Playwright smoke suite passes.

| Decision | Commit |
|---|---|
| 1 — request deadline | `ba8df9f` |
| 2 — edit-sheet delete through the outbox | `8d0108a` |
| 3, 4 — shell revalidation and the API 404 | `fc0c7e2` |
| 9 — id-reuse 409s and the Telegram deadlines | `17ff933` |
| 5 — loading, failed and empty | `d6f9c7b` |
| 7, 8 — Threshold cap and the drift items | `d0f4fea` |
| 6 — the two dialogs portal and go inert | `bc71d21` |
| 8 — the copy table | `0a2af89` |

Two things went past the spec's literal wording, both deliberate:

- **`POST /trackers`'s inline `variants` array.** Decision 9 names only the two standalone creates, but the nested loop is the same bug with the same client-supplied id, so it got the same 409. The Tracker and its Variants now insert in one transaction: a colliding Variant id has to roll the Tracker row back, or the 409 leaves a half-built Tracker and the caller's retry collides on the Tracker id instead — a create that could never succeed. That transaction is the first in the codebase.
- **`useDeleteEntry`'s failure path.** The outbox rethrows on a 401 and on a storage failure that already discarded the record. Swallowing both would leave the history pages rendering a delete nothing is holding, so the hook drops its own cache edit and lets the server say what history actually has. No toast: on the 401 the login screen is swapping in anyway, the same reason `useLogRow`'s own failure messages are unreachable.

The `Out of Scope` list above stands as written; nothing on it was picked up.
