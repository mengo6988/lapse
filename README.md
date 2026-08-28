# lapse

Single-user, self-hosted app for answering "when did I last do X?" — tap once to log a Tracker (tyre pressure check, vacuuming, a run), and the home list shows what's overdue by how much, sorted by urgency rather than a due date. Not a todo app or a habit tracker: no streaks, no checkboxes, no guilt mechanics. See `CONTEXT.md` for the full vocabulary (Tracker, Variant, Entry, Threshold) and `docs/spec.md` for the product spec.

## Stack

Vite + React SPA (TypeScript) served by a Hono server on Node 22, with SQLite (via `better-sqlite3` and Drizzle ORM) on a mounted volume. One Docker image, one container, no split frontend/backend deploy. A single shared password (`LAPSE_PASSWORD`) gates the whole app — there are no user accounts. Full detail and the reasoning behind each choice: `docs/tech-stack.md`.

## Running it

There are three ways to run lapse, depending on what you're doing.

### 1. Local development

```bash
corepack enable   # once per machine — pins pnpm to the version in package.json
pnpm install
LAPSE_PASSWORD=devpassword pnpm dev
```

pnpm is the package manager here, pinned by the `packageManager` field. Two settings in `package.json` matter on a fresh clone: `pnpm.onlyBuiltDependencies` allows `better-sqlite3` and `esbuild` to run their install scripts, which pnpm 10 blocks by default, and `node-gyp` is a devDependency so `better-sqlite3` can compile from source on a Node version with no prebuilt binary. Without the first, the server suite fails at import with `Could not locate the bindings file`.

`pnpm dev` starts the Hono server (`dev:server`, `tsx watch src/server/index.ts`) and the Vite dev server (`dev:client`) together. The app is served by Vite at `http://localhost:5173`, which proxies `/api/*` requests to the server on `:3000`. `LAPSE_PASSWORD` has no default and isn't read from any `.env` file for this path (there's no dotenv loading in `dev:server`) — the server exits immediately on boot if it's unset, so export it or prefix the command as above. Any non-empty value works locally.

The session cookie is set with `Secure`, which normally requires HTTPS — but browsers treat `localhost` as a secure context regardless of scheme, so logging in at `http://localhost:5173` still works.

```bash
pnpm test             # vitest run — client (jsdom) + server (node) projects
pnpm coverage         # vitest run --coverage — fails under the 80% threshold
pnpm typecheck        # tsc --noEmit, client and server configs
pnpm e2e              # playwright test — smoke journeys against the built app
```

`pnpm e2e` is not part of the unit-test loop: it builds the app, starts the real server on a throwaway SQLite database, and drives three journeys through Chromium at a phone viewport (see `playwright.config.ts` and `e2e/`). It needs the browser installed once, with `pnpm exec playwright install chromium`.

### 2. Local Docker (testing the real container)

To test the actual production image — the same Dockerfile, same boot sequence, same migrations — without a VPS, a domain, or Traefik:

```bash
docker compose -f compose.dev.yaml up --build
```

The app is served at `http://localhost:8080`. There is no setup step: `compose.dev.yaml` bakes in an obvious throwaway password (`lapse-dev-only-password`) — export `LAPSE_PASSWORD` yourself, or use a `.env`, if you want a different one — and keeps its database in a named Docker volume rather than a directory in the working tree, so nothing needs creating or chowning first.

To wipe that database and start clean:

```bash
docker compose -f compose.dev.yaml down -v
```

See the comments in `compose.dev.yaml` for the reasoning behind the port, password, and volume choices.

### 3. Production

Traefik-routed, on a VPS, no published ports, served at `lapse.mengo.dev`. Uses `compose.yaml`:

```bash
docker compose up -d --build
```

This is an operator action, not a dev-loop one — see `docs/deploy.md` for the full runbook (one-time setup, deploying/updating, verifying it worked).

## Data and backups

In production the SQLite database (`lapse.db`) lives in `./data` on the host, bind-mounted into the container, and persists across rebuilds and restarts because it's outside the container filesystem. Local Docker testing uses a named volume instead, for the reasons in `compose.dev.yaml`. The app takes its own daily backup in-process (`VACUUM INTO`, pruned to the newest 7). Full detail, including a drilled restore procedure: `docs/deploy.md` § Data and backups.

## Docs map

| File | Answers |
|---|---|
| `CONTEXT.md` | Domain vocabulary — Tracker, Variant, Entry, Threshold, and what to avoid calling them |
| `docs/spec.md` | Product spec: features, domain rules, sorting, data model, API |
| `docs/design.md` | Visual direction, UX, screens, copy tone |
| `docs/tech-stack.md` | Stack choices, testing strategy, ops (Docker, boot sequence, backup) |
| `docs/deploy.md` | Operator runbook for the production VPS deploy |
| `docs/adr/` | Architecture decision records — the *why* behind stack and auth choices |
| `docs/grill-checklist.md` | What's settled vs. still open before/while building |
| `docs/build-plan.md` | v1 milestone build plan |
| `docs/v2-checklist.md` | What's explicitly out of scope for v1 |
| `docs/agents/` | Conventions a coding agent follows in this repo (issue tracker, domain-doc usage, triage labels) |
