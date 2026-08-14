# Single self-hosted container, no split deployment

Lapse ships as one Docker container: a Hono server that serves both the REST API and the built Vite React SPA, with SQLite on a mounted volume (Actual Budget model). We rejected Vercel-hosted frontend + self-hosted backend: it adds CORS, two deploys, and a publicly exposed API for zero benefit to a single user reaching the app over Tailscale/LAN.

## Consequences

- Frontend and backend version together; no API compatibility window needed.
- Backup = copy the SQLite file on the volume.
- The server stays a dumb CRUD layer; sorting/overdue math lives client-side (this also keeps the offline-lite path simple — see ADR-0002).
