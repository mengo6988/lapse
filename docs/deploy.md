# Deploy

Operator runbook for running lapse on the Contabo VPS behind the existing Traefik v3 instance. See `docs/tech-stack.md` § Ops for the design decisions behind this.

## One-time setup

1. **DNS**: create an A record for `lapse.mengo.dev` pointing at the VPS's public IP, and confirm it resolves (`dig +short lapse.mengo.dev`).
2. **Traefik network**: the external Docker network named `traefik` must already exist on the VPS (it's shared with the other services Traefik routes to). If it doesn't: `docker network create traefik`.
3. **Environment file**: on the VPS, in the repo checkout, copy `.env.example` to `.env` and set `LAPSE_PASSWORD` to a strong value. `.env` is git-ignored — it never gets committed.
4. **Clone the repo** onto the VPS if not already present, at whatever path you'll run `docker compose` from.
5. **Data directory ownership**: the container runs as the non-root `node` user (uid 1000), and `./data` is bind-mounted from the host, so its ownership comes from the host, not the image. Before the first run: `mkdir -p data && sudo chown 1000:1000 data`. Skipping this makes the container fail to boot with `EACCES` writing `lapse.db`.

## Deploying / updating

From the repo directory on the VPS:

```bash
git pull && docker compose up -d --build
```

There is no registry and no CI publish step — the VPS builds the image itself from the checked-out source. Every deploy, including the first one, is this same command.

## Verifying it worked

- `docker compose ps` should show the `lapse` service as `healthy` (the container's built-in HEALTHCHECK polls `/api/health` every 30s; allow ~30-40s after startup for the first check to land).
- Visit `https://lapse.mengo.dev` on a phone or browser: the certificate should be valid (issued via Traefik's `myresolver`), and the login screen should appear.
- Log in with `LAPSE_PASSWORD`. The app shell should load.
- `docker compose logs lapse` shows `lapse listening on :3000` on a clean boot, with no migration or env errors above it. If `LAPSE_PASSWORD` is unset or the migrations fail integrity checks, the container logs the failure and exits — `docker compose ps` will show it exited rather than healthy.

## Data and backups

The SQLite database (`lapse.db`) lives in the `./data` directory on the VPS host, bind-mounted into the container at `/data` (see `compose.yaml`). It persists across `docker compose up -d --build` and container restarts because it lives on the host, not in the container filesystem.

Daily in-process backups to `/data/backups/lapse-YYYY-MM-DD.db` (via `VACUUM INTO`, not a raw file copy — copying a live WAL-mode database risks corruption, keeping the last 7) are **not implemented yet**: they land with build ticket 20. Until then the only copy of the data is `./data/lapse.db` on the host. Offsite backup of that directory is the host's job — back it up with whatever snapshot or backup mechanism the VPS already uses.
