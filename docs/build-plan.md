# Lapse — v1 Build Plan

> Produced by the build handoff grill (2026-08-15), the final ticket of the lapse-v1 wayfinder map. Every decision this plan relies on is already settled in `docs/spec.md`, `docs/tech-stack.md`, `docs/design.md`, and `docs/adr/` — implementation must not reopen them. Workflow: TDD per the global rules (RED → GREEN → REFACTOR, 80% coverage enforced by the Vitest config thresholds, no CI in v1).
>
> Interaction reference: `.scratch/lapse-v1/assets/12-home-prototype.html` (accepted prototype). Visual reference: `.scratch/lapse-v1/assets/06-chosen-direction-ledger-mocha.html`.

Shape: walking skeleton first (M0), then thin horizontal layers — the API is dumb CRUD and the client owns all domain logic, so vertical slicing buys little. Each milestone is **done** when its checklist is complete, both Vitest projects are green with coverage thresholds passing, and the app still builds and deploys.

## M0 — Walking skeleton (deployable end-to-end)

- [ ] Single-package scaffold per tech-stack repo shape: `src/client` (Vite + React + TS), `src/server` (Hono on Node 22), one `package.json` (scripts: `dev`, `build`, `test`, `coverage`)
- [ ] Vitest two-project config (`client` jsdom / `server` node), `@vitest/coverage-v8`, 80% thresholds + agreed exclusions
- [ ] **First RED tests** (one per project): server — `GET /api/health` via `app.request()`; client — urgency ratio/state pure module (spec § Domain rules)
- [ ] Boot sequence: Zod env parse (`PORT`, `DATA_DIR`, `LAPSE_PASSWORD` required) → pragmas (WAL / NORMAL / busy_timeout 5000 / FK ON) → FK-wrapped `migrate()` + `foreign_key_check` → serve; any failure exits 1
- [ ] Drizzle + better-sqlite3 wired, migrations folder runs on boot (schema itself lands in M1)
- [ ] Auth: `POST /auth/login` with `crypto.timingSafeEqual`, httpOnly + Secure + SameSite=Lax cookie (1y), auth middleware on `/api` (health exempt) — rate limit deferred to M5
- [ ] Hono serves built SPA + a minimal shell page
- [ ] Multi-stage Dockerfile (`node:22-bookworm-slim` both stages, `USER node`, node-fetch HEALTHCHECK), `compose.yaml` with Traefik labels
- [ ] **First deploy**: DNS A record for `lapse.mengo.dev`, `git pull && docker compose up -d --build` on the VPS — ops path proven before any feature exists

## M1 — Core CRUD (server complete)

- [ ] Full Drizzle schema: `categories`, `trackers`, `variants`, `entries` — UUIDv7 text PKs, ISO-text timestamps, spec indexes, cascades / soft-delete `deletedAt` on variants
- [ ] Category seed on first run (house / car / health / personal)
- [ ] All spec endpoints with Zod validation (`@hono/zod-validator`): trackers (create/edit/archive/hard-delete), variants (add/patch/soft-delete), entries (idempotent `POST /entries` with client UUIDv7, future `occurredAt` clamped to server-now, patch/delete), categories CRUD, cursor-paginated history, bootstrap payload exactly per spec
- [ ] Integration tests per endpoint: `app.request()` + `:memory:` SQLite, migrations in suite setup, fresh DB per test file — covering validation errors, idempotent replay, clamp, archived-tracker entry acceptance

## M2 — Read UI (glanceable ledger)

- [ ] TanStack Query with cache persisted to IndexedDB (`idb-keyval`); bootstrap hydrates on launch
- [ ] Pure modules + unit tests: sort order (never → ratio desc → thresholdless), urgency state, effective threshold (variant inherit), observed interval (mean of last 10 gaps, ≥3 entries), threshold suggestion (>30% deviation)
- [ ] Design tokens, Source Serif 4 + IBM Plex Mono, noise texture, dark-only palette per design.md
- [ ] Home digest: slipping cards (top 3), quick-log tiles, all-items footer, `nothing slipping` empty state
- [ ] List tab: category chips, in-place search (`no matches`), urgency underline bars, never/neutral row treatments
- [ ] Bottom tab bar + FAB shell; activity/settings as stubs; header = wordmark + magnifier only (home magnifier routes to list with search open)

## M3 — Write UI (the point of the app)

- [ ] Tap-to-log: optimistic Entry, fresh-state settle, `logged ✓` toast + undo — 5s window with freeze-then-resort choreography per design.md/prototype
- [ ] Long-press (450ms) log sheet: time chips (now / 1h ago / yesterday / pick), duration chips, note
- [ ] Create/edit tracker: name-first minimal add; collapsed category / threshold presets / variants; archive
- [ ] Tracker detail/history: per-variant summaries, entry list (cursor pagination), entry edit/delete, observed-interval line + threshold-suggestion hints
- [ ] Archived view: unarchive, hard delete with entry-count confirm

## M4 — Offline-lite + PWA

- [ ] Outbox per tech-stack contract: IndexedDB, UUIDv7 ids, serial drain, exponential backoff + full jitter, 4xx dead-letter with manual retry — unit-tested with `fake-indexeddb` + stubbed `fetch` (drain order, backoff, dead-letter, undo, rehydration overlay)
- [ ] vite-plugin-pwa: precached shell, silent auto-update (periodic `registration.update()`, `immediate: true`, `vite:preloadError` reload), no-cache headers on `sw.js`/`index.html`
- [ ] Pending chip in home header (`2 queued`, peach on failure) + queued sheet with retry-all / per-entry discard
- [ ] Branding assets: icon SVG source, sharp script → committed PNG set (192 / 512 / 512-maskable / 180), manifest (`Lapse`, `#1e1e2e`)

## M5 — Ship

- [ ] Daily `VACUUM INTO /data/backups/` + prune to 7; restore drill once (open a backup copy, verify)
- [ ] Login rate limit: fixed window 10 / 15 min per first `X-Forwarded-For` hop, login route only
- [ ] Activity screen (recent Entries feed) + settings (categories manager, archived list, logout) — in-build design pass extending the committed tokens, no separate mock
- [ ] Copy audit: all strings from the design.md canonical table, lowercase voice
- [ ] Playwright smoke against built app + real server + temp SQLite file: create → tap-log → fresh; long-press log; archive
- [ ] Final deploy; confirm HEALTHCHECK, backup file appears, PWA installs on iOS

## After v1

`docs/v2-checklist.md` holds everything deferred; notifications (ntfy) is the designated v1.1. The wayfinder map (`.scratch/lapse-v1/map.md`) is a frozen archive — new fog gets a new map.
