# 08 — Query layer with persisted cache

**What to build:** The app opens instantly from its last known state, then reconciles with the server. Launching hydrates from the bootstrap payload; a cold reload paints from the IndexedDB-persisted cache before the network answers.

**Blocked by:** 06 (Categories CRUD and bootstrap payload).

**Status:** resolved

- [x] TanStack Query configured with the bootstrap fetch hydrating the cache at launch
- [x] Cache persisted to IndexedDB via `idb-keyval`, restored before first paint
- [x] Client storage is treated as disposable: clearing it recovers fully from bootstrap with no data loss, because the server is the record of truth
- [x] A 401 from the API routes the user to the login screen rather than failing silently
- [x] Tests cover hydration from a persisted snapshot and the disposable-storage recovery path
