# Offline-lite (outbox + precache), not a local-first sync engine

The one real offline scenario is logging an Entry with no signal (garage, basement). v1 covers it with: service-worker shell precache (vite-plugin-pwa, `registerType: 'autoUpdate'` — avoids the stale-bundle footgun that gives PWAs a bad name), a persisted client query cache for reads, and an outbox that queues failed Entry POSTs and replays them when online. Conflict policy is last-write-wins.

We deliberately did NOT adopt a local-first sync engine (ElectricSQL, PowerSync, Zero, LiveStore, Triplit, hand-rolled CRDT). Those mostly require Postgres or a dedicated sync service — incompatible with the single-container SQLite constraint (ADR-0001) — and for a single user with append-mostly data they produce no user-visible improvement over the outbox. Revisit only if multi-device concurrent *editing* ever produces real conflicts.
