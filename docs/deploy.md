# Deploy

Operator runbook for running lapse on the Contabo VPS behind the existing Traefik v3 instance, via `compose.yaml`. See `docs/tech-stack.md` § Ops for the design decisions behind this. To run the same image locally, without a VPS, a domain, or Traefik — for testing the real container before it ships — see `compose.dev.yaml` and the README instead; none of what follows applies to that path.

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

There is no registry and no CI publish step — the VPS builds the image itself from the checked-out source. Every deploy, including the first one, is this same command. The host needs Docker and nothing else: Node and pnpm exist only inside the build stage, which enables pnpm through Corepack at the version pinned in `package.json`.

## Verifying it worked

- `docker compose ps` should show the `lapse` service as `healthy` (the container's built-in HEALTHCHECK polls `/api/health` every 30s; allow ~30-40s after startup for the first check to land).
- Visit `https://lapse.mengo.dev` on a phone or browser: the certificate should be valid (issued via Traefik's `myresolver`), and the login screen should appear.
- Log in with `LAPSE_PASSWORD`. The app shell should load.
- `docker compose logs lapse` shows `lapse listening on :3000` on a clean boot, with no migration or env errors above it. If `LAPSE_PASSWORD` is unset or the migrations fail integrity checks, the container logs the failure and exits — `docker compose ps` will show it exited rather than healthy.

## Data and backups

The SQLite database (`lapse.db`) lives in the `./data` directory on the VPS host, bind-mounted into the container at `/data` (see `compose.yaml`). It persists across `docker compose up -d --build` and container restarts because it lives on the host, not in the container filesystem.

The app writes a daily backup itself, in-process (`src/server/backupSchedule.ts`, scheduled from `index.ts`'s boot sequence — a plain `setInterval`, no cron dependency): once on boot and then every 24 hours, it runs `VACUUM INTO '/data/backups/lapse-YYYY-MM-DD.db'` (`src/server/backup.ts`) and prunes to the newest 7 files. `VACUUM INTO` is deliberately not a filesystem copy of `lapse.db` — the live file is WAL-mode and can be mid-write, so a raw copy risks capturing a torn, corrupt snapshot; `VACUUM INTO` asks SQLite itself for a transactionally consistent copy instead. If two boots land on the same calendar day, the second run replaces that day's file rather than erroring (SQLite's `VACUUM INTO` refuses to write to a path that already exists). A failed backup is logged to the container's stdout but never stops the server — check `docker compose logs lapse` for `backup failed:` lines if `./data/backups` looks stale.

Offsite backup of `./data` (both `lapse.db` and `./data/backups`) is still the host's job — back it up with whatever snapshot or backup mechanism the VPS already uses.

### Restore drill

Performed locally on 2026-08-15 against the real boot path (`openDatabase` from `src/server/db.ts`, with migrations applied) rather than a synthetic table, to confirm the whole chain works, not just the `VACUUM INTO` call in isolation:

1. Opened a fresh database in a temp `DATA_DIR` the same way `index.ts` does on boot (pragmas + migrations).
2. Inserted one row each into `categories`, `trackers`, and `entries` through the real Drizzle schema.
3. Called the real `runBackupJob(sqlite, dataDir, now)` — the same function the daily scheduler calls — which wrote `<DATA_DIR>/backups/lapse-2026-08-15.db` via `VACUUM INTO` and ran pruning.
4. Opened *only the backup file* with a brand-new `better-sqlite3` connection (`{ readonly: true }`), never touching the live connection again, and queried `categories`, `trackers`, and `entries` back out.

All three rows came back intact, including the tracker's `name` and `threshold_days`. To repeat this under pressure — say, to prove a specific dated backup on the VPS is actually restorable before you trust it:

```bash
# on the VPS, or with the file copied somewhere you can run node
node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/backups/lapse-2026-08-15.db', { readonly: true });
console.log(db.prepare('SELECT COUNT(*) AS n FROM trackers').get());
console.log(db.prepare('SELECT * FROM entries ORDER BY occurred_at DESC LIMIT 5').get());
db.close();
"
```

A real disaster-recovery restore (replacing a broken `lapse.db` with a backup) is: stop the container, copy the chosen `/data/backups/lapse-YYYY-MM-DD.db` over `/data/lapse.db`, then `docker compose up -d`. That specific replace-and-boot path has not been drilled end-to-end against a running container — the verification above proves the backup file itself is a valid, complete, readable database, which is the part `VACUUM INTO` is responsible for.
