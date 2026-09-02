# Spec: Client deepening — retire the ticket-fence residue

**Status:** resolved — all eight tickets shipped in `dc5940e..24bb969`

## Problem Statement

Lapse v1 was built by parallel, file-fenced tickets. The fences worked — the app shipped in six commits — but they are still frozen into the client, and now every change to a shared rule costs four edits instead of one.

Concretely, from the perspective of whoever changes this code next:

- The rule "a Tracker with Variants contributes one row per Variant, never a tracker-level row of its own" (`docs/spec.md § Domain rules`) is written out four times. Three of those modules say so in their own header comment and name the fence that stopped them sharing.
- Four modules in four feature directories perform immutable surgery on the same cached bootstrap payload. Changing the payload's shape means finding all four.
- Ten mutation hooks are the same three lines each: send the write, graft the response into a cache. Ten modules, ten test files, and the policy questions they all answer (what happens on 401, what happens offline, when to invalidate rather than graft) have ten separate answers.
- The Entry write path is owned by two modules that import each other. `log/entryApi` drives the outbox's claim lock; `outbox/drainOutbox` reaches back into `log/` for the request body builder. The rules for a failed write — dead-letter a 4xx, back off a 5xx, drop on 401 — are written once in each.
- Two modules are byte-identical, and the Entry wire schema is defined three times, because the original was never exported.

None of this is a bug today. All of it is a tax on the next change, and the tax compounds: a new screen that lists Trackers gets a fifth row-flattener by default.

## Solution

Five behaviour-preserving deepenings. The app looks and behaves identically afterwards; the difference is that each rule has one owner.

1. **One Tracker row-flattener.** `trackerRows` in the domain module, returning the existing `ListRow` shape, with flags for the two things that actually differ between callers (include archived, sort by urgency). Home, List, Detail and Archived all call it.
2. **One owner for the bootstrap cache.** All four cache-surgery modules move next to the query that owns the key. Features name the change they want; only that module knows the payload's shape.
3. **One interface for a write.** `useBootstrapWrite(spec)` where a spec declares the route, the method, and how the response merges into cache. The ten named hooks become one-line specs.
4. **One owner for sending an Entry write.** A single module under the outbox owns queue-then-send for both the live path and the drain. The log feature keeps optimistic UI, freeze and undo, and stops knowing the outbox exists.
5. **Delete the twins.** One infinite-scroll sentinel, one exported Entry schema.

## User Stories

1. As the developer, I want the Tracker-to-row rule to exist in one module, so that a change to it is one edit and not four.
2. As the developer, I want a new screen that lists Trackers to call an existing flattener, so that I don't create a fifth copy by default.
3. As the developer, I want Home and List to use the same row shape, so that a formatter written for one works for the other without a second version.
4. As the developer, I want the archived-versus-active distinction to be a flag on one function, so that "should this screen show archived Trackers?" is answered in one place.
5. As the developer, I want urgency sorting to be an option on the flattener rather than a step callers remember, so that a screen can't silently ship unsorted.
6. As the developer, I want Detail's row builder to stop duplicating List's unexported helpers, so that the two can't drift.
7. As the developer, I want one module to own writes to the cached bootstrap payload, so that adding a field to a Tracker means reading one file.
8. As the developer, I want cross-entity cache rules (deleting a Category nulls `categoryId` on its Trackers) to live beside the other rules for that payload, so that they aren't discovered by accident in a settings directory.
9. As the developer, I want the optimistic `latestEntry` write to sit with the rest of the payload surgery, so that "what can change in this cache" has one answer.
10. As the developer, I want the paginated entry-history cache to stay separate from the bootstrap cache, so that two genuinely different caches don't get merged into one confusing module.
11. As the developer, I want one interface for "send a write and update cache", so that the ten existing writes stop being ten places to look.
12. As the developer, I want 401 handling defined once for every write, so that session expiry behaves the same everywhere without ten hooks agreeing by hand.
13. As the developer, I want the choice between grafting a response and invalidating a query to be an explicit part of a write's spec, so that the current mix of both is legible rather than incidental.
14. As the developer, I want writes that update the entry-history cache to use the same interface as writes that update bootstrap, so that there's one shape for a write regardless of which cache it touches.
15. As the developer, I want per-field validation errors to keep reaching the form field that caused them, so that the deepening doesn't cost the error UX the forms already have.
16. As the developer, I want adding an eleventh write to be a one-line spec, so that the next endpoint doesn't add a module and a test file.
17. As the developer, I want one module to own sending a queued Entry write, so that the retry rules aren't written twice and kept in step by comment.
18. As the developer, I want the claim lock's races (claim before enqueue, release before settle) to be reasoned about inside one module, so that the correctness argument fits in one file.
19. As the developer, I want the log feature to stop importing the outbox store, so that optimistic UI and durability are separable concerns.
20. As the developer, I want the drain to stop importing a body builder from the log feature, so that the dependency between those two features runs one way.
21. As the user, I want a tap logged while offline to still stand, retry, and appear in the pending chip exactly as it does today, so that the refactor costs me nothing.
22. As the user, I want undo of a still-queued log to keep dropping the queued write outright rather than sending a compensating delete, so that offline undo stays a local operation.
23. As the user, I want a write the server rejected to keep dead-lettering into the queued sheet for manual retry, so that nothing retries forever behind my back.
24. As the developer, I want one infinite-scroll sentinel, so that a fix to it applies to both the Activity feed and the Tracker detail history.
25. As the developer, I want the Entry wire schema exported from the module that already defines it, so that a third parser isn't written the next time an endpoint returns Entries.
26. As the developer, I want Activity and Detail to keep their own page sizes and routes, so that deduplication doesn't erase a real difference.
27. As the developer, I want the test suite to shrink alongside the source, so that the retired modules don't leave tests asserting a structure that no longer exists.
28. As the developer, I want each new deep module to have one test file at its own interface, so that the test surface matches the module surface.
29. As the developer, I want the existing screen tests and the Playwright smoke suite to pass untouched at every step, so that "behaviour-preserving" is a claim the suite checks rather than one I make.
30. As the user, I want every screen — Home, List, Activity, Detail, Archived, Settings — to look and behave exactly as it does now, so that this work is invisible to me.

## Implementation Decisions

### General

- All five are behaviour-preserving. Any change a user could notice is a defect, not a scope extension.
- `CONTEXT.md` vocabulary is authoritative in module and function names: Tracker, Variant, Entry, Threshold, Overdue, Category, Archive.
- No new dependencies. No server changes. No schema or API-contract changes.
- ADR-0001 (single container, self-hosted) and ADR-0002 (offline-lite, not a sync engine) are respected throughout. Deepening 4 in particular keeps the same queue, the same retry policy and the same dead-letter behaviour — it changes who owns them, not what they are.

### 1 — Tracker row flattening

- One module in the domain area exposes `trackerRows(trackers, now, options)` returning the existing `ListRow` shape.
- Options carry the two real differences between the current four callers: whether archived Trackers are included, and whether the result is sorted by urgency. Detail additionally needs a single-Tracker entry point; that is the same function over a one-element list.
- `HomeRow` is retired. Home's fields are a subset of `ListRow`, so Home's card and tile take `ListRow`.
- The domain modules the flatteners already delegate to — effective threshold, urgency state, urgency sort — are unchanged. This deepening reshapes data and does not touch the math.
- The archived screen's caller stops filtering by `archivedAt` itself and asks for archived rows instead.

### 2 — Bootstrap cache ownership

- One module beside the bootstrap query owns every write to the cached bootstrap payload: add/patch Tracker, add/patch/remove Variant, add/patch/remove Category, remove Tracker (hard delete), and set a Tracker's or Variant's `latestEntry`.
- Its interface is named by domain change, not by cache mechanics — callers ask for "the Category was deleted", and the module knows that also nulls `categoryId` on the Trackers that referenced it.
- The paginated entry-history cache stays where it is. It is a different query, a different shape, and merging the two would produce one module with two subjects.
- The mutation-response wire shapes (the Drizzle row shape returned by the Tracker and Variant write routes, which has no `latestEntry`) move with the module that grafts them.

### 3 — One write interface

- `useBootstrapWrite(spec)` — one hook, taking a spec of `{ path, method, onSuccess }` where `path` may be a function of the input, and `onSuccess` names the cache change.
- The cache change is one of two kinds: **graft** (apply a named change from deepening 2, or from the entry-history cache module) or **invalidate** (mark bootstrap stale and refetch). The current code already uses both — entry edit and delete invalidate bootstrap because `latestEntry` is server-authoritative — and the spec makes that choice explicit rather than incidental.
- Error handling stays exactly as today: the existing tracker error type, per-field messages parsed from a 400 body, and 401 or an unreachable server collapsing to the single "couldn't save — try again" message.
- Named hooks may remain as one-line specs where a call site reads better for one. That is a call-site readability decision, not an architectural one — the rule is that no named hook contains logic.
- The logout mutation is out of this deepening: it is not a write against a cache, it clears the session.
- Depends on deepening 2 — the specs' `onSuccess` values are that module's named changes.

### 4 — Entry write ownership

- One module under the outbox owns sending an Entry write. Its interface is three functions: post an Entry, delete an Entry, and drain the queue once.
- Everything currently split between the live-send path and the drain moves inside: record-before-send ordering, the claim lock, settle, the 401 rule (retire the record and rethrow), the 4xx rule (dead-letter), the 5xx/network rule (leave pending, report the attempt count for backoff), and the create-body builder.
- Scheduling stays out. The existing drain hook keeps owning mount, store-change, `online` and backoff-timer triggers; the deepened module has no timers and no listeners.
- The log feature keeps the optimistic cache write, the freeze snapshot, the toast window and undo, and calls only the three functions above. It stops importing the outbox store.
- The undo-of-a-still-queued-create rule is preserved verbatim, including the dead-letter case: dropping the queued create outright, never queueing a compensating delete behind it.
- The re-entrancy guard and the rerun-request behaviour are preserved, including the rule that a rerun is only taken when the finished pass has nothing waiting on a backoff.

### 5 — Fence-stranded twins

- One infinite-scroll sentinel module, in a shared location, used by both the Activity feed and the Tracker detail history.
- The Entry schema is exported from the module that already defines it for the bootstrap payload; both entry-fetching modules import it instead of redefining it.
- Both entry-fetching modules keep their own route, page-size constant and page type. Detail's smaller page size is a deliberate tuning decision for a rarely-visited screen and survives.
- Mechanical, no design decisions remaining. Sequenced first so later deepenings don't have to work around the duplicates.

## Testing Decisions

### What a good test looks like here

Every deepening is behaviour-preserving, so the tests have two jobs: prove the observable behaviour is unchanged, and give each new deep module a test surface at its own interface. A good test here asserts what a caller can observe — the rows a screen renders, the cache state after a write, what reached the network and in what order — and never that a particular helper was called.

The seam is the deepened interface, backed by the screen tests as the unchanged-behaviour net.

### The net (must stay green, unmodified, at every step)

- The route-level screen tests: Home, List, Activity, Archived, Settings, Tracker detail. These render a screen against a fixture bootstrap payload and a query client, and they are the strongest existing statement of what the app does.
- The Playwright smoke suite: create-then-log, backdated log, archive a Tracker.
- The log-row test file, which already covers the optimistic write, undo, the frozen-order window and the failure paths in detail.

A change to any of these while implementing a deepening means the refactor stopped being behaviour-preserving. Fix the source, not the test.

### The new seams (one test file per deep module)

- **Row flattening** — the flattener's own tests, covering every case the four retiring test files covered between them: a Tracker without Variants, a Tracker with Variants, archived included and excluded, sorted and unsorted, a Tracker whose Variants carry their own Thresholds. Prior art: the existing list row-builder tests.
- **Bootstrap cache** — the merged module's own tests, covering each named change and the cross-entity rule for Category deletion. Prior art: the four cache test files being retired; their cases carry over.
- **Write interface** — one test file exercising the hook against a fake fetch: graft, invalidate, per-field 400, 401, and network failure. Prior art: the existing mutation-hook tests, which already establish the query-client-wrapper pattern.
- **Entry write ownership** — one test file covering queue-then-send, the claim lock under a concurrent trigger, 401, dead-letter on 4xx, backoff reporting on 5xx, ordering of a create/delete pair, and undo of a still-queued create. Prior art: the existing entry-api and drain test files, which together already cover all of this and merge into one.

### Retiring tests

Test files for modules that no longer exist are deleted with them. The cases they assert must first appear in the new module's test file — a case is moved, never dropped. Roughly fifteen test files retire; the coverage does not.

## Out of Scope

- Any change to the server, the database schema, the API contract, or the migrations.
- Any visual, copy or interaction change. The design docs are unchanged by this work.
- Building a sync engine, changing the retry or backoff policy, or widening the outbox beyond Entry writes (ADR-0002).
- Deepening the server route modules, the domain math modules, or the query-persistence layer — none showed the same friction.
- New screens, new endpoints, new features of any kind.
- Test-coverage expansion beyond carrying existing cases across. If a gap is found while moving a case, note it; don't fill it in the same ticket.
- The logout mutation, which is not a cache write.

## Further Notes

- Deepenings 1, 2 and 5 are independent of each other. 3 depends on 2. 4 is independent of all of them.
- 5 first: it is mechanical, it clears duplicates the later work would otherwise have to route around, and it is a cheap way to confirm the net is green before the real changes start.
- The recurring signal to look for while working: a header comment that explains why a module could not share code with another. Every one of those is a fence that outlived its ticket. Delete the comment along with the duplication.
