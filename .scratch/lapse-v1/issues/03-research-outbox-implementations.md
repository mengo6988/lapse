# Outbox implementation research

Type: research
Status: resolved

## Question

Survey how to implement the offline mutation outbox (ADR-0002: failed `POST /entries` queued with client-generated uuid, replayed on reconnect, idempotent server-side) before hand-rolling:

- TanStack Query built-ins: paused mutations + `persistQueryClient` / `PersistQueryClientProvider` resume, `onlineManager` — can they BE the outbox? Known caveats (mutation defaults needed for hydration, ordering guarantees)
- Workbox Background Sync — supported on iOS Safari at all?
- Existing small libraries for offline mutation queues worth adopting vs a hand-rolled localStorage queue
- Replay ordering + retry/backoff patterns; how others handle clock skew on backdated offline entries
- Recommendation with citations: TanStack-native vs hand-rolled vs library

## Answer

Resolved 2026-08-14 by research agent. **Recommendation: hand-rolled outbox in IndexedDB — not TanStack mutation persistence, not a library.**

### 1. TanStack Query built-ins — can they BE the outbox?

Mechanically yes (paused mutations + `persistQueryClient` = a storage-backed queue), but the mutation-persistence path carries sharp caveats:

- **Replay is parallel, not FIFO-serial.** `resumePausedMutations()` preserves initiation order but runs all mutations concurrently; serial execution requires explicit mutation `scope: { id }`. ([Discussion #7466](https://github.com/TanStack/query/discussions/7466))
- **`resumePausedMutations()` is not idempotent against concurrent callers** — two near-simultaneous calls race; maintainer guidance is one central call on reconnect. ([Discussion #9439](https://github.com/TanStack/query/discussions/9439))
- **Reload trap**: persisted mutations lose their `mutationFn` closure ("functions cannot be serialized"); resuming after app-kill requires `setMutationDefaults(mutationKey, { mutationFn })` registered on the QueryClient *before* hydration, else `"No mutationFn found"`. Multiple reports of mutations sitting inert when the registration is skipped or mis-ordered. ([Issue #5847](https://github.com/TanStack/query/issues/5847), [Discussion #7044](https://github.com/TanStack/query/discussions/7044), [case study](https://githits.com/blog/tanstack-query-checkout-outbox-case-study/))
- **`onlineManager` false positives**: v5 assumes online and listens to `online`/`offline` window events only — no reachability probing; browser can report online while the API is unreachable (captive portal). ([OnlineManager docs](https://tanstack.com/query/v5/docs/reference/onlineManager))
- Persisted cache `gcTime` maxes ~24 days (setTimeout integer overflow) unless timeout provider swapped. ([persistQueryClient docs](https://tanstack.com/query/v5/docs/framework/react/plugins/persistQueryClient))

### 2. Workbox Background Sync on iOS

**Not supported — hard platform gap.** The native Background Sync API (`SyncManager`) has zero Safari support (checked through Safari 26.x + TP); Chromium-only. Open WebKit gap for years, no commitment to ship. ([caniuse](https://caniuse.com/background-sync), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API), [workbox#2516](https://github.com/GoogleChrome/workbox/issues/2516))

Implication: replay must be **foreground-driven** (app load, `online` event, visibilitychange, manual sync) — no service-worker background replay on iOS. Matches ADR-0002's "replay on reconnect" framing.

### 3. Library survey

- **`@tanstack/offline-transactions`** — real and maintained (part of TanStack DB monorepo); durable outbox, exponential backoff + jitter, IndexedDB with localStorage fallback, multi-tab leader election. **Catch: requires TanStack DB collections** — a materially bigger architecture commitment than one mutation type needs.
- `@imirfanul/react-offline-sync` — low visibility, unclear maintenance. `react-relay-offline` — GraphQL/Relay, irrelevant. RxDB — sync-engine class, ruled out by ADR-0002.
- No small, battle-tested, framework-light "just an outbox" library exists. Realistic field: TanStack-native vs hand-rolled.

### 4. Ordering, backoff, clock skew

- **Ordering**: use **UUIDv7** (time-sortable) for the client-generated id — free deterministic ordering without server coordination.
- **Backoff**: exponential with full jitter — `delay = min(cap, base * 2^attempt) * random()`. Split retryable (network, 5xx) from non-retryable (4xx → dead-end + surface to user, never loop).
- **Clock skew**: documented failure class (field-data postmortem: clock reset to 2014 → two weeks of wrong timestamps; "duplicate records and clock skew = 60% of data issues"). For lapse the risk is narrower — single user, LWW, entries independent by uuid — so skew is a display/sort artifact, not corruption. Mitigation: store client `occurredAt` AND server-stamped `createdAt`/receivedAt; never resolve anything purely on the client clock. ([postmortem](https://thefieldco.com/blog/offline-first-field-software/))

### 5. Recommendation: hand-rolled (~100–150 lines)

Practitioner consensus for small apps: TanStack paused-mutation mechanics "just work" for network blips while the app stays open, but the *persistence* path (registration trap, resume race, parallel replay) is the fiddly part; nobody recommends TanStack DB/RxDB for one mutation type. With exactly one mutation that matters, a thin owned queue sidesteps every §1 caveat.

**Implementation sketch:**

- **Storage: IndexedDB** (via `idb`), not localStorage — localStorage is synchronous on the optimistic-update path. Installed home-screen PWAs get their own storage counter, exempt from the 7-day Safari-tab eviction ([Apple forums](https://developer.apple.com/forums/thread/710157)) — note in ADR that this hinges on "added to home screen".
- **Record**: `{ uuid (v7), payload, createdAt (client), attempts, status: pending | inflight | failed }`.
- **Write path**: write outbox record first (durable) → optimistic cache update → attempt POST. Success → remove record. Failure → leave `pending`. Set `retry: false` on the TanStack mutation — the outbox IS the retry mechanism; don't run two retry systems.
- **Replay triggers** (all foreground): app load/hydration (covers hard-killed app); `online` event (treated as "maybe online" — truth is the request outcome); `visibilitychange → visible` (iOS PWA resume from app-switcher, where `online` may not fire).
- **Serial drain loop**: pop oldest-by-uuid pending, POST, await, next. One in-flight request, one backoff timer; guarded by a module-level "drain running" flag (two-line fix for the resume-race problem).
- **Failure modes handled**: app killed mid-queue (drain on load); false-positive online (re-queue on failure regardless); duplicate delivery (server idempotent by uuid — client must never reuse a uuid across different logical entries); multi-tab double-drain (harmless given idempotency; no leader election needed); skewed clocks (dual timestamps); long-offline queue growth (cap attempts, surface permanently-failed entries in UI, never silently drop).

Key sources: [Mutations guide — persisting offline mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) · [persistQueryClient](https://tanstack.com/query/v5/docs/framework/react/plugins/persistQueryClient) · [Network Mode](https://tanstack.com/query/v4/docs/framework/react/guides/network-mode) · [Discussion #9585 — offline PWA config](https://github.com/TanStack/query/discussions/9585) · [caniuse background-sync](https://caniuse.com/background-sync) · [@tanstack/offline-transactions](https://github.com/TanStack/db/tree/main/packages/offline-transactions)
