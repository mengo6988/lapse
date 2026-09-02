# 08 — One owner for sending an Entry write

**What to build:** Two modules currently own sending a queued Entry write — the live path and the drain — and they import each other to stay in step. After this ticket one module owns it. Logging offline, undoing a queued log, the pending chip, the queued sheet and manual retry all behave exactly as they do now.

**Blocked by:** None — can start immediately.

**Status:** resolved

Kept whole rather than split: the correctness argument is the claim lock's races, and neither half of a split is green on its own.

Everything currently divided between the two modules moves inside: record-before-send ordering, the claim lock, settle, the create-body builder, and the failure rules — retire the record and rethrow on 401, dead-letter anything else the server rejected on its merits, leave a network failure or server error pending and report the attempt count for backoff.

Scheduling stays out. The existing drain hook keeps owning mount, store-change, online and backoff-timer triggers; the deepened module has no timers and no listeners.

The log feature keeps the optimistic cache write, the freeze snapshot, the toast window and undo. It stops knowing the outbox exists.

Stays inside ADR-0002 — same queue, same retry policy, same dead-letter behaviour, one owner instead of two.

- [x] One module owns sending an Entry write, exposing post, delete and drain-once
- [x] The log feature calls only those three and no longer imports the outbox store
- [x] The drain no longer imports anything from the log feature
- [x] A tap logged offline still stands, queues, retries and shows in the pending chip
- [x] Undo of a still-queued create still drops the queued write outright, including when it has dead-lettered, rather than queueing a compensating delete
- [x] A create still lands before the delete that undoes it; a pass stops rather than sending a later item ahead of one waiting on backoff
- [x] A rejected write still dead-letters into the queued sheet for manual retry
- [x] The re-entrancy guard and the rerun-request rule are preserved, including that a rerun is only taken when the finished pass has nothing waiting on a backoff
- [x] The two retired modules' test files merge into one at the new interface, carrying every case: queue-then-send, the claim lock under a concurrent trigger, 401, dead-letter, backoff reporting, create/delete ordering, undo of a still-queued create
- [x] The log-row test file passes unmodified; the Playwright smoke suite passes

## Answer

Shipped in `380f054` — refactor: one owner for sending an Entry write.
