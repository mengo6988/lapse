# 02 — Docker image and first deploy

**What to build:** The skeleton is reachable from a phone at `https://lapse.mengo.dev`, gated by the password, with a valid certificate — the whole ops path proven before any feature exists.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent — container half done, operator half outstanding

- [x] Multi-stage Dockerfile using `node:22-bookworm-slim` for both stages, running as `USER node`, with a node-based HEALTHCHECK hitting the health route
- [x] `compose.yaml` joins the existing external `traefik` network with the `websecure` entrypoint, the `myresolver` certresolver, service port 3000, and a named volume mounted at the data dir
- [ ] DNS A record for `lapse.mengo.dev` points at the VPS and resolves publicly
- [x] Deploy procedure runs on the VPS as `git pull && docker compose up -d --build`, with no registry involved, and is written down where the next deploy can follow it — see `docs/deploy.md`
- [ ] Logging in with `LAPSE_PASSWORD` over HTTPS succeeds and the shell page loads on a phone; the container reports healthy and the SQLite file lives on the volume across a restart

Verified locally instead: the image builds, boots as `node`, answers `/api/health` with 200, reports healthy to Docker's own HEALTHCHECK, and keeps `lapse.db` across a container restart on a bind mount. The two unchecked boxes need the VPS and the DNS zone, which only the operator can reach.

Operator steps, in order (detail in `docs/deploy.md`): create the A record for `lapse.mengo.dev`, confirm the external `traefik` network exists, write `.env` with `LAPSE_PASSWORD`, `mkdir -p data && sudo chown 1000:1000 data`, then `git pull && docker compose up -d --build`.
