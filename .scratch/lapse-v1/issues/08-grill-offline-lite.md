# Offline-lite implementation grill

Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

Settle offline-lite mechanics on top of the research findings: outbox approach (TanStack-native vs hand-rolled vs library), replay order + retry policy, dedup/idempotency details, clock handling for backdated offline entries, "pending sync" indicator UX, and SW update behavior/prompt UX on iOS. Output: implementation-ready notes appended to `docs/tech-stack.md` (and ADR-0002 amendments if the approach shifts).

## Answer

Resolved 2026-08-15, grill round of 8 questions — all settled per recommendation:

1. **Approach**: hand-rolled outbox in IndexedDB (via `idb`) per the outbox research — serial drain oldest-first by UUIDv7, one in-flight, module-level drain flag, no leader election (double-drain harmless, server idempotent by id). TanStack mutation persistence and libraries rejected.
2. **Scope**: `POST /entries` only. All other mutations fail fast offline with a toast.
3. **Retry**: exponential backoff full jitter, base 2s cap 60s, within a drain run; fresh run per trigger (app load, `online`, `visibilitychange`). Retryable = network/5xx; 4xx dead-letters to `failed` with manual retry/discard. Never silently drop a log.
4. **Clock skew**: server **clamps** future `occurredAt` to server-now instead of 400 (spec § Validation amended) — wrong clock degrades to an editable timestamp, not a lost entry. Dual timestamps stand.
5. **Cache persister**: TanStack cache → IndexedDB (`createAsyncStoragePersister` + `idb-keyval`), replacing the localStorage line in tech-stack (ADR-0002 amended).
6. **SW update**: silent auto-update, **no prompt UI** — `immediate: true` reload, 15-min periodic `registration.update()`, `vite:preloadError` guarded reload, no-cache headers on `sw.js`/`index.html`. Resolves the "SW update prompt UX" fog line.
7. **Pending UI**: header mono chip ("2 queued", clock glyph, `overlay2`; peach when failed) → tap opens sheet with queued/failed list, retry-all, per-entry discard. Optimistic row updates, no per-row pending markers.
8. **Undo offline**: still-queued entry → remove outbox record + revert cache; already-POSTed → `DELETE /entries/:id`, on network failure show "couldn't undo — offline"; deletes never queue.

Plus one no-alternative consequence recorded without grilling: on reload, pending outbox entries **overlay** bootstrap data (as `latestEntry` where newer) so offline-logged rows don't flip back to overdue.

**Docs updated**: `docs/tech-stack.md` (§ Offline-lite rewritten as implementation contract + SW update section, stack table line), `docs/spec.md` (occurredAt clamp), `docs/design.md` (pending chip UX), `docs/adr/0002` (amendment: IndexedDB, scope, foreground-only replay).
