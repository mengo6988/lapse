# 23 — Ship v1

**What to build:** The last pass before v1 is real: every string in the intended voice, the critical journeys proven end-to-end against a real build, and a final deploy verified on the phone it was designed for.

**Blocked by:** 13 (Long-press log sheet), 15 (Tracker detail and history), 18 (PWA and branding assets), 19 (Pending chip and queued sheet), 20 (Backups and login rate limit), 21 (Activity screen), 22 (Settings screen).

**Status:** ready-for-agent — agent half done, operator half outstanding

- [x] Copy audit: every user-facing string matches the canonical strings table in `docs/design.md`, lowercase in-product voice throughout
- [x] Playwright smoke against the built app with a real server and a temporary SQLite file, covering create then tap-log then verify fresh after reload, a backdated long-press log, and archiving a Tracker
- [x] Both Vitest projects green with the coverage thresholds passing
- [ ] Final deploy to `lapse.mengo.dev`
- [ ] Post-deploy verification: container reports healthy, a backup file appears on schedule, and the PWA installs and launches on iOS

## Post-agent integration notes

Three agent-reachable criteria done; the last two need the VPS and a phone.

- **Copy audit** found exactly one deviation across the whole client: `could not log in` was the only failure message not using the app's "couldn't X" contraction. Everything with a canonical row already matched byte-for-byte, `✓` and em-dashes included. It also caught an error in `docs/design.md`'s ticket-17 retirement note — it named `couldn't save — retrying` as a retired constant, but that string was never implemented; the two constants ticket 17 made 401-only are `couldn't log — try again` and `couldn't undo — offline`. Corrected, and the six live strings that had no canonical row were added to the table.
- **Playwright smoke** (`npm run e2e`, ~20s including the build): three journeys against `npm run build && npm start` on a throwaway SQLite database under `data/e2e`, Chromium at a Pixel 7 viewport. Two details worth keeping: proving an Entry reached SQLite requires clearing IndexedDB before the reload, because the persisted query cache plus a 60s `staleTime` would otherwise repaint the client's own optimistic write; and the long-press is dispatched as `pointerdown`/`pointerup` straight at the element, because the log sheet's full-viewport scrim mounts mid-hold and would swallow a real hit-tested mouseup.
- **It immediately earned its keep** by failing two of three journeys against a real bug — a double-send race in the outbox, described below. The suite was left asserting the correct behaviour rather than weakened to pass.

**The bug it found, which came from build ticket 17's own integration:** a write is recorded before it is attempted (durable-first), and that enqueue notifies the store synchronously — which wakes the reactive drain, which finds a queued item nobody has sent and sends it. Two POSTs for one Entry. Whichever settled second found the record already gone, read that as an undo racing ahead of it, and queued the compensating delete that exists for exactly that case — erasing the Entry that had just been created. Fixed with an in-memory send-claim (`claimOutboxItem`/`releaseOutboxItem`): one sender per id, which is also what makes `settleSentOutboxItem`'s "the record vanished, so it was undone" inference sound in the first place. Deliberately not an item `status` — it describes a live promise in this tab, so persisting it would only leave a lie for the next launch to read.

**Still outstanding, both operator-only:** the final deploy to `lapse.mengo.dev` (blocked on ticket 02) and post-deploy verification — container healthy, a backup file appearing on schedule, and the PWA installing and launching on iOS (blocked on ticket 18).
