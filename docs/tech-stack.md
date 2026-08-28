# Lapse — Tech Stack & Deployment (v1)

> Settled in grilling session 2026-08-14. See ADR-0001..0003 for the why.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite + React SPA (TypeScript) | No meta-framework; SEO irrelevant, SPA fine |
| Data fetching | TanStack Query | Persisted cache (IndexedDB via `idb-keyval`) for offline reads |
| Backend | Hono (Node 22) | Serves `/api/*` + static `dist/`; ~6 route files |
| DB | SQLite via better-sqlite3 + Drizzle ORM | Migrations run on boot |
| PWA | vite-plugin-pwa, `registerType: 'autoUpdate'` | Manifest + SW shell precache; avoids stale-bundle footgun (ADR-0002) |
| Auth | Single password (`LAPSE_PASSWORD` env, **required**), httpOnly + Secure + SameSite=Lax cookie, 1y expiry | Public deployment — see ADR-0003 amendment |
| Machine auth | Optional `LAPSE_API_TOKEN`, `Authorization: Bearer` on `/api/*` | For Shortcuts/scripts/the bot, which can't hold a cookie — `docs/capture.md` |
| Zero-UI capture | Optional Telegram bot, long polling, no new route | `docs/capture.md` |
| Container | Single Docker image, multi-stage build | Volume mount `/data` for `lapse.db` |

## Offline-lite (in v1, per ADR-0002 + offline-lite grill 2026-08-15)

- SW precaches app shell → app opens with no network.
- TanStack Query cache persisted to **IndexedDB** (`createAsyncStoragePersister` + `idb-keyval`, not localStorage) → last-known list renders offline.
- Last-write-wins everywhere; no sync engine.

### Outbox (hand-rolled, ~100–150 lines, IndexedDB via `idb-keyval`)

- **Scope: `POST /entries` and `DELETE /entries/:id`.** Every other mutation fails fast offline with a toast — no queueing. Deletes are queued (amending this section's original "deletes are never queued", build ticket 17) because undo is the second half of tap-to-log: an undo of an Entry the server already has must survive being offline exactly as the log did. Ordering falls out of the serial drain — a create is always ahead of the delete that undoes it — and undo of a write still sitting in the queue drops that record outright instead of queueing a compensating delete.
- **Record**: `{ id (client UUIDv7 — also the Entry id, which is what makes a replay idempotent), kind: create | delete, input (the POST body; null for a delete), queuedAt, attempts, status: pending | dead }`. No `inflight` state: one pass sends one item at a time and the drain-running flag already says whether anything is in flight, so persisting it would only ever be a lie left behind by a killed tab.
- **Write path**: outbox record first (durable) → optimistic cache update → attempt POST → success removes record. TanStack mutation gets `retry: false` — the outbox IS the retry mechanism.
- **Replay**: foreground-only (Background Sync unsupported on iOS). Triggers: app load/hydration, `online` event, `visibilitychange → visible`. Serial drain oldest-first by UUIDv7, one in-flight request, module-level drain-running flag. Multi-tab double-drain is harmless (server idempotent by id); no leader election.
- **Retry policy**: exponential backoff, full jitter — `delay = min(60s, 2s·2^attempt)·random()` — within a drain run; each trigger starts a fresh run. Retryable: network error, 5xx. Non-retryable: 4xx → status `failed` (dead-letter), surfaced in UI, manual retry/discard only. No attempts cap that silently drops — a queued log lives until sent or user-discarded.
- **Rehydration overlay**: after bootstrap fetch, pending outbox entries re-apply on top of server data (as `latestEntry` where newer) so a row logged offline doesn't flip back to overdue on reload.
- **Undo (5s toast)**: entry still queued → delete outbox record + revert cache, server never touched. Already POSTed → `DELETE /entries/:id`, itself queued if it can't be sent. The one gap that needs closing explicitly: undo can land while that create's own request is in flight, in which case the Entry is created after the record is gone — a successful send whose record has vanished queues the delete undo skipped, rather than dropping it and letting the Entry reappear at the next bootstrap.
- **Clock skew**: dual timestamps (client `occurredAt`, server `createdAt`); server **clamps** future `occurredAt` to server-now instead of rejecting (see spec § Validation) so a skewed clock degrades to a slightly-wrong editable timestamp, never a lost log.
- **Pending UI**: mono chip in the app header, on every tab rather than home only ("2 queued", clock glyph, `overlay2`; peach when any has dead-lettered); tap → sheet listing queued/failed entries with retry-all / per-entry discard. No per-row pending markers. See docs/design.md § Feel for why the chip is not home-only.

### SW update behavior (iOS-proofing, from PWA research)

Silent auto-update, **no prompt UI**:

- `registerType: 'autoUpdate'`; workbox `navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/api/]`, `cleanupOutdatedCaches: true`.
- Entry point: `registerSW({ immediate: true })` (reload on controllerchange) + 15-min periodic `registration.update()` (fetch sw.js `cache: 'no-store'` first) — compensates for iOS's launch-only, 24h-throttled checks.
- `window.addEventListener('vite:preloadError', reload)` with a sessionStorage guard — stale lazy-chunk 404 safety net.
- Server sends `Cache-Control: max-age=0, must-revalidate` on `sw.js` + `index.html` (wire in Ops).

## Testing (settled in testing-strategy grill 2026-08-15)

Global rules apply: TDD (tests first), 80% minimum coverage, unit + integration + E2E.

- **Runner**: Vitest, single config with two projects — `client` (jsdom) + `server` (node). One `pnpm test` runs both; one merged coverage report. Deps: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `jsdom`, `fake-indexeddb`, `@playwright/test`.
- **Unit (client)**: urgency ratio, sorting, observed interval, and threshold-suggestion logic live in pure modules and carry most coverage as plain unit tests. Component tests (Testing Library + jsdom) stay thin: wiring only — tap logs, undo toast, category chips filter. No Vitest browser mode.
- **Unit (outbox)**: the hand-rolled outbox is the main risk surface — full unit coverage with `fake-indexeddb` + stubbed `fetch`: drain order, backoff/jitter, 4xx dead-letter, undo paths, rehydration overlay. The service worker itself is vite-plugin-pwa output and is not tested; SW registration glue is excluded from coverage.
- **Integration (API)**: Hono `app.request()` (in-process, no HTTP server) against better-sqlite3 `:memory:` with Drizzle migrations applied in suite setup; fresh DB per test file. Covers routes, Zod validation, entry idempotency, and the occurredAt clamp.
- **Telegram bot**: everything the bot decides — name matching, what gets written, what it replies, and the
  chat allowlist — is a pure function over an in-memory database (`updateReply`/`handleMessage`), and the four
  Bot API calls are tested against a stubbed `fetch`. The poll loop itself (`startTelegramBot`) is not: it is
  a `while` around one tested call, in the same class as the SW glue above. Verified by hand against a real
  bot token, including that a rejected `getUpdates` logs, backs off, and leaves the HTTP server serving.
- **E2E**: thin Playwright smoke suite — 2–3 journeys against the built app + real server + temp SQLite file: create tracker → tap log → row fresh; long-press detailed log; archive flow. No SW/offline simulation in E2E (offline correctness is carried by the outbox unit layer).
- **Coverage gate**: 80% lines/functions/statements/branches as thresholds in the Vitest config, so `vitest run --coverage` fails under threshold anywhere, including locally. Excluded: entrypoints (`main.tsx`, server boot), SW registration glue, migrations folder, config files. No CI in v1 (ops grill) — the config-level gate on local runs is the enforcement.

## Ops (settled in ops grill 2026-08-15, folding in stack-validation research)

### Docker image

- Multi-stage, `node:22-bookworm-slim` for **both** stages (pinned explicitly — `node:22-slim` is an alias that will drift to trixie). Build stage installs `python3 make g++` only as a prebuild fallback for better-sqlite3; never copy host-compiled `node_modules` in.
- Package manager is pnpm, pinned by `packageManager` in `package.json` and enabled in both stages with `corepack enable`. pnpm 10 blocks dependency install scripts by default, so `pnpm.onlyBuiltDependencies` lists `better-sqlite3` and `esbuild`; without it the native binding is silently missing and the container fails at boot rather than at build.
- Runtime stage: `pnpm install --prod --frozen-lockfile`, `USER node`. No numeric size budget — multi-stage + prod-only install is the budget.
- `HEALTHCHECK --interval=30s` via `node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"` (slim image has no curl).

### Boot sequence

1. Zod-parse env: `PORT` (default 3000), `DATA_DIR` (default `/data`), `LAPSE_PASSWORD` (**required**, non-empty — boot exits when unset; see ADR-0003 amendment).
2. Open DB, set pragmas: `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`, `foreign_keys = ON`.
3. `migrate()` wrapped in `PRAGMA foreign_keys = OFF/ON`, then assert `PRAGMA foreign_key_check` returns zero rows.
4. Serve.

Any env/migration failure: log + `process.exit(1)` — never serve against a partial schema.

### Backup

Never copy the live db file (WAL corruption — stack-validation research). In-process daily `VACUUM INTO '/data/backups/lapse-YYYY-MM-DD.db'` via `setInterval`, prune to the last 7 snapshots. Offsite is the host's job (back up the volume/snapshot dir with whatever the VPS already uses). Litestream deliberately skipped — revisit if the data outgrows "annoying to lose".

### Deployment (Contabo VPS, existing Traefik v3)

Public domain **`lapse.mengo.dev`** (DNS A record → the VPS), TLS by the existing Traefik certresolver. Password-gated per ADR-0003 amendment. `compose.yaml` in repo; no published ports — Traefik routes over its network (`exposedbydefault=false`, so the enable label is required):

```yaml
services:
  lapse:
    build: .
    restart: unless-stopped
    volumes:
      - ./data:/data
    environment:
      - LAPSE_PASSWORD=${LAPSE_PASSWORD}
    networks: [traefik]
    labels:
      - traefik.enable=true
      - traefik.http.routers.lapse.rule=Host(`lapse.mengo.dev`)
      - traefik.http.routers.lapse.entrypoints=websecure
      - traefik.http.routers.lapse.tls.certresolver=myresolver
      - traefik.http.services.lapse.loadbalancer.server.port=3000

networks:
  traefik:
    external: true
```

Deploy/update flow: on the VPS, `git pull && docker compose up -d --build`. No registry, no CI publish — revisit if a second host appears.

App serves plain HTTP behind Traefik; login rate limit reads client IP from the first `X-Forwarded-For` hop. `Cache-Control: max-age=0, must-revalidate` on `sw.js` + `index.html` set by the Hono static handler (per SW update section).

### CI

None in v1 (explicit override of the global CI rule, on record in the ops grill). The 80% coverage gate is enforced by Vitest config thresholds on every local `vitest run --coverage`. Revisit GitHub Actions when the project leaves single-dev flow.

## iOS/PWA facts informing this (researched 2026-08-14)

- 7-day storage wipe applies to Safari tabs, NOT installed home-screen apps.
- iOS 26 makes every add-to-homescreen standalone by default.
- Standalone mode has no OS back gesture → app provides its own back navigation (see design.md).
- Web push (iOS 16.4+) exists but subscriptions silently vanish — reminders deferred to v1.1 via ntfy instead (one HTTP POST from backend, reliable, both platforms).

## Repo shape (single package)

```
/
├── src/
│   ├── client/        # Vite React app
│   └── server/        # Hono app, drizzle schema, migrations
├── docs/
├── Dockerfile
└── package.json
```
