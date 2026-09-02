# 17 — Offline outbox

**What to build:** A log tap taken with no network is not lost: it queues locally, the UI still shows the row as fresh, and the queue drains in order once the app is next open and online.

**Blocked by:** 12 (Tap-to-log).

**Status:** resolved

- [x] A failed Entry POST queues in IndexedDB rather than surfacing an error; the optimistic UI state is unaffected
- [x] Queued Entries carry their client-generated UUIDv7 id, so a replay that the server already received is idempotent
- [x] The queue drains serially in order, with exponential backoff and full jitter between attempts
- [x] A 4xx response dead-letters the item for manual retry instead of retrying forever; 5xx and network failures keep retrying
- [x] Undo removes a still-queued item outright rather than queueing a compensating delete
- [x] The queue rehydrates on launch and drains in the foreground (Background Sync is unavailable on iOS)
- [x] Unit tests with `fake-indexeddb` and a stubbed fetch cover drain order, backoff growth, dead-lettering, undo of a queued item, and rehydration after a reload

## Post-agent integration notes

Built by a fenced parallel agent alongside ticket 19, over a seam written before either launched: `src/client/outbox/outboxStore.ts` (the queue, its IndexedDB persistence, and the mutators both lanes need). The store deliberately knows nothing about draining, so the dependency runs one way — retry-all flips dead items back to pending and the drain notices through the store's own subscription.

Four defects found by reading the implementation, not the agent's report (which said complete and green). Each fixed RED→GREEN:

1. **A create whose queue record vanished mid-request was dropped.** Undo drops a still-queued create outright — right for a write that never left the device — but the undo window is five seconds, so the request may already be on the wire. The Entry the user undid then gets created after all and reappears at the next bootstrap. `settleSentOutboxItem` now queues the delete undo skipped when a successful send finds its record gone.
2. **Undo of a dead-lettered create sent a network DELETE.** The server had rejected that create, so the DELETE 404s, and a 404 is a 4xx — it dead-lettered a second junk item next to the first. `deleteEntry` now drops a queued create of any status.
3. **A trigger arriving mid-pass was swallowed by the re-entrancy guard**, so a retry-all landing while a pass ran did nothing until the next external trigger. The turned-away trigger is now remembered and gets its own pass — but only when the finished pass has nothing waiting on a backoff, or the item that just failed would be resent with no delay at all.
4. **Attempt-then-queue instead of queue-then-attempt.** `docs/tech-stack.md` § Outbox settled on the record being durable *before* the request; queueing only after a failure loses the write if the app is killed mid-request, which on iOS is an ordinary way for a backgrounded PWA to end. Rewritten to `sendQueued`: enqueue, attempt, retire on success.

Deviations from the ticket, both deliberate:

- **No `fake-indexeddb`.** Tests use the injectable `KeyValStore` seam this repo already uses for the query cache (`src/client/query/storage.ts` explains why). Same coverage, no new dependency.
- **Deletes are queued**, amending `docs/tech-stack.md`'s original "deletes are never queued". Undo is the second half of tap-to-log: an undo of an Entry the server already has must survive being offline exactly as the log did. Doc updated.

Knock-on: `useLogRow.ts` needed no code change but four of its tests asserted the retired "a failed POST reverts and toasts" behaviour, rewritten to the new contract. Two canonical strings (`couldn't save — retrying`, `couldn't undo — offline`) lost their trigger and are recorded as retired under `docs/design.md`'s canonical strings table.

**Not built, and worth a ticket:** `docs/tech-stack.md` § Outbox also specifies a *rehydration overlay* — pending outbox entries re-applied on top of a fresh bootstrap fetch so a row logged offline doesn't flip back to overdue on reload. It is in neither this ticket's acceptance criteria nor ticket 19's. The window is usually brief (launch drains and bootstrap fetch race, and the drain usually wins), but a dead-lettered write stays visibly wrong until it is retried or discarded.
