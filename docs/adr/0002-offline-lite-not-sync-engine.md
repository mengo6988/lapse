# Offline-lite (outbox + precache), not a local-first sync engine

The one real offline scenario is logging an Entry with no signal (garage, basement). v1 covers it with: service-worker shell precache (vite-plugin-pwa, `registerType: 'autoUpdate'` — avoids the stale-bundle footgun that gives PWAs a bad name), a persisted client query cache for reads, and an outbox that queues failed Entry POSTs and replays them when online. Conflict policy is last-write-wins.

We deliberately did NOT adopt a local-first sync engine (ElectricSQL, PowerSync, Zero, LiveStore, Triplit, hand-rolled CRDT). Those mostly require Postgres or a dedicated sync service — incompatible with the single-container SQLite constraint (ADR-0001) — and for a single user with append-mostly data they produce no user-visible improvement over the outbox. Revisit only if multi-device concurrent *editing* ever produces real conflicts.

## Amendment (2026-08-15, offline-lite grill)

Storage moved from localStorage to **IndexedDB** for both the outbox (via `idb`) and the persisted query cache (via `createAsyncStoragePersister` + `idb-keyval`): iOS localStorage is ~5MB shared-origin and synchronous on the optimistic-update path. Installed home-screen PWAs get their own storage partition exempt from Safari's 7-day tab eviction — this hinges on the app being added to the home screen; all client storage remains a disposable cache, the server is the record of truth. Outbox scope confirmed as `POST /entries` only; other mutations fail fast offline. TanStack mutation persistence and outbox libraries rejected (registration trap, resume race, parallel replay — see outbox research). Background Sync API unsupported on iOS: replay is foreground-only. Implementation contract: `docs/tech-stack.md` § Offline-lite.
