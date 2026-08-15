# Ops grill

Type: grilling
Status: resolved
Blocked by: 01

## Question

Settle deployment/operations details, folding in stack-validation findings: Docker base image + size budget, healthcheck endpoint, SQLite backup automation (litestream vs cron copy — WAL implications from research), Tailscale serve config, and boot sequence (migrations, env validation). Output: ops section in `docs/tech-stack.md`.

## Answer

Resolved 2026-08-15, three grill rounds (6 + 2 + 2 questions). Deployment target shifted mid-grill: not Tailscale-only homelab but a **public domain behind the existing Traefik v3 container on a Contabo VPS** — which forced the auth hardening below.

1. **Backup**: in-process daily `VACUUM INTO /data/backups/lapse-YYYY-MM-DD.db` via `setInterval`, prune to last 7. Offsite = host's volume backup. Litestream rejected for now (new service + S3 creds for a personal tracker).
2. **Ingress**: existing Traefik on the VPS routes `lapse.mengo.dev` (DNS A record → VPS) over the external `traefik` Docker network — entrypoint `websecure`, certresolver `myresolver`, `traefik.enable=true` label (provider has `exposedbydefault=false`), service port 3000, no published ports. Original "Tailscale serve" framing dropped.
3. **Dockerfile**: multi-stage `node:22-bookworm-slim` both stages (pinned — `node:22-slim` alias will drift), `npm ci --omit=dev`, `USER node`, node-`fetch` HEALTHCHECK every 30s. No numeric size budget.
4. **Boot**: Zod env parse (`PORT` 3000, `DATA_DIR` /data, `LAPSE_PASSWORD` required) → pragmas (WAL / NORMAL / busy_timeout 5000 / FK ON) → FK-wrapped `migrate()` + `foreign_key_check` → serve; any failure exits 1.
5. **CI**: none in v1 — explicit user override of the global CI rule; coverage gate enforced by Vitest config thresholds locally.
6. **Deploy flow**: build on the VPS — `git pull && docker compose up -d --build`; `compose.yaml` in repo; no registry.
7. **Auth hardening** (consequence of public exposure): `LAPSE_PASSWORD` required, boot refuses unset ("auth off" mode deleted); `crypto.timingSafeEqual` compare; cookie `httpOnly + Secure + SameSite=Lax`; in-app login rate limit 10 attempts / 15 min per IP (first `X-Forwarded-For` hop), login route only. Actual Budget pattern.

**Docs updated**: `docs/tech-stack.md` (§ Deployment replaced by § Ops with compose.yaml; auth row; testing CI line), `docs/spec.md` (auth login line), `docs/adr/0003` (amendment: public deployment, required password, rate limit, cookie flags).
