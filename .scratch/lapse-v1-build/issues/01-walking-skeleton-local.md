# 01 — Walking skeleton (local)

**What to build:** A developer can clone the repo, set `LAPSE_PASSWORD`, run one dev command, and get a running app: the server boots against a SQLite file, serves a minimal password-gated shell page, and answers an unauthenticated health check. Both Vitest projects run with coverage thresholds enforced, starting from the two first RED tests.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Single-package scaffold per the tech-stack repo shape: Vite + React + TypeScript client, Hono on Node 22 server, one `package.json` with `dev` / `build` / `test` / `coverage` scripts
- [x] Vitest two-project config (client jsdom, server node) with `@vitest/coverage-v8` and 80% thresholds plus the agreed exclusions
- [x] The two first tests are written RED before any implementation: server `GET /api/health` via `app.request()`, and the client urgency ratio/state pure module per spec § Domain rules — both green by the end of this ticket
- [x] Boot sequence: Zod env parse (`PORT`, `DATA_DIR`, `LAPSE_PASSWORD` required) → pragmas (WAL, synchronous NORMAL, busy_timeout 5000, foreign_keys ON) → foreign-key-wrapped `migrate()` + `foreign_key_check` → serve; any failure exits 1 with a readable message
- [x] Drizzle + better-sqlite3 wired with a migrations folder that runs on boot (the schema itself lands in ticket 03)
- [x] `POST /auth/login` compares with `crypto.timingSafeEqual` and sets an httpOnly + Secure + SameSite=Lax cookie with a one-year lifetime; auth middleware guards `/api` with health exempt (the login rate limit is deliberately deferred to ticket 20)
- [x] Hono serves the built SPA plus a minimal shell page, so a logged-in browser sees something real
