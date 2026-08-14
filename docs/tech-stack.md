# Lapse — Tech Stack & Deployment (v1)

> Settled in grilling session 2026-08-14. See ADR-0001..0003 for the why.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite + React SPA (TypeScript) | No meta-framework; SEO irrelevant, SPA fine |
| Data fetching | TanStack Query | Persisted cache (localStorage) for offline reads |
| Backend | Hono (Node 22) | Serves `/api/*` + static `dist/`; ~6 route files |
| DB | SQLite via better-sqlite3 + Drizzle ORM | Migrations run on boot |
| PWA | vite-plugin-pwa, `registerType: 'autoUpdate'` | Manifest + SW shell precache; avoids stale-bundle footgun (ADR-0002) |
| Auth | Single password (`LAPSE_PASSWORD` env), httpOnly cookie, 1y expiry | Unset env = auth off (ADR-0003) |
| Container | Single Docker image, multi-stage build | Volume mount `/data` for `lapse.db` |

## Offline-lite (in v1, per ADR-0002)

- SW precaches app shell → app opens with no network.
- TanStack Query cache persisted → last-known list renders offline.
- Outbox: failed `POST /entries` queued in localStorage with client-generated uuid, replayed on reconnect. Idempotent server-side by id. Last-write-wins everywhere; no sync engine.

## Deployment

- `docker run -p 3000:3000 -v lapse-data:/data -e LAPSE_PASSWORD=... lapse`
- Reached from iPhone over Tailscale; Tailscale's built-in HTTPS (real Let's Encrypt certs) makes PWA install clean on iOS. Self-signed certs won't install without manual root-trust — avoid.
- Backup = copy `/data/lapse.db`.

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
