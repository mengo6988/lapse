# Stack validation research

Type: research
Status: resolved

## Question

Stress-test the chosen backend stack — Hono (Node 22) serving `/api/*` + static `dist/`, better-sqlite3 + Drizzle ORM, SQLite on a Docker volume, multi-stage image — against real-world reports. Specifically:

- better-sqlite3 native-module gotchas in Docker (alpine vs debian base, Node ABI mismatches, prebuilt binaries)
- Drizzle migrate-on-boot pattern: recommended setup, failure modes
- SQLite production settings for this shape (WAL mode, busy_timeout, backup implications of copying a live db file, litestream compatibility)
- Real projects shipping Hono + Drizzle + SQLite single-container — do they exist, what bit them
- Do alternatives (Elysia, Fastify; raw SQL over Drizzle) show a *concrete* advantage for this use case?

Standing rule: recommend a swap only on a concrete failure finding, not preference.

## Answer

Resolved 2026-08-14 by research agent. **Verdict: keep the stack as chosen — no alternative cleared the concrete-failure bar.** The exact combination (Hono + better-sqlite3 + Drizzle, single container, `/data` volume) is proven in production by [R44VC0RP/hark](https://github.com/R44VC0RP/hark).

### 1. better-sqlite3 in Docker

- Node 22 = `NODE_MODULE_VERSION` 127; prebuilt binaries exist for all major platform/arch/libc combos — source compilation is only a fallback.
- The real failure mode is a **mismatched build/runtime libc pair** (compile in glibc stage, run in musl/Alpine stage → "Exec format error"). Alpine itself works if build + runtime share the same Alpine base and you `npm rebuild better-sqlite3` inside it (confirmed by two real repos).
- Maintainer guidance when asked about Docker friction: just use Debian slim. ([discussion #1270](https://github.com/WiseLibs/better-sqlite3/discussions/1270))
- **Recommendation: `node:22-bookworm-slim` for BOTH build and runtime stages**; install `python3 make g++` in the build stage only as a prebuild fallback; never copy host-compiled `node_modules` into the image.
- Aside: Node 22.13+ has experimental `node:sqlite` (zero native deps, Drizzle-supported) — noted, but better-sqlite3 remains the faster, production-recommended option; no reason to swap.

### 2. Drizzle migrate-on-boot

Official pattern: `drizzle-kit generate` at dev time (plain readable `.sql` files, committed) → at boot `migrate(db, { migrationsFolder })` from `drizzle-orm/better-sqlite3/migrator`, tracked in a `__drizzle_migrations` table.

Failure modes:
- **No concurrency lock** — multiple processes running `migrate()` can corrupt bookkeeping. N/A for lapse (single container) but noted. ([#874](https://github.com/drizzle-team/drizzle-orm/issues/874))
- **No rollback on partial failure** — a multi-statement migration failing midway leaves a half-applied schema. Boot must hard-exit on migration failure, never serve against a partial schema. ([#2510](https://github.com/drizzle-team/drizzle-orm/issues/2510))
- **FK pragma is a no-op inside a transaction**, and Drizzle wraps SQLite migrations in one — so table-rebuild migrations can silently skip FK enforcement. Copy hark's pattern verbatim: `PRAGMA foreign_keys = OFF` before `migrate()`, `ON` after, then assert `PRAGMA foreign_key_check` returns zero violations.

### 3. SQLite production settings

Set at every connection open:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;  -- safe in WAL: crash loses at most last txn, never corrupts
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

**Backups: naively copying the live `.db` file is NOT safe.** WAL keeps recent commits in `-wal`/`-shm`; copying files at slightly different instants produces a corrupt copy — sqlite.org documents this explicitly, and one dev's 6-hourly naive-copy backups were all corrupt. ([How To Corrupt](https://www.sqlite.org/howtocorrupt.html)) Safe options: **Litestream** (WAL-required, driver-agnostic — works with better-sqlite3 unmodified, streams WAL frames to S3-class storage ~1s interval) or periodic **`VACUUM INTO 'snapshot.db'`** (safe on a live DB) and back up the snapshot. This corrects `docs/tech-stack.md`'s current "backup = copy /data/lapse.db" line — feed into Ops grill.

### 4. Real projects

- **[R44VC0RP/hark](https://github.com/R44VC0RP/hark)** — closest match: Hono 4 + better-sqlite3 13 + drizzle 0.45, `node:22-trixie-slim` both stages, `/data` volume, migrate-before-serve, WAL + FK pragmas, `HEALTHCHECK` hitting `/api/health`. Gap to avoid: doesn't set `busy_timeout`/`synchronous`.
- fiioonnn/kerncms (Alpine multi-stage, migrate-then-start as non-root), deadcoder0904/easypanel-nextjs-sqlite (Drizzle + Litestream + volume), ITACHI1061/monorepo-starter (Hono + Alpine + explicit rebuild). Consolidated pain points across all: libc mismatch, FK-pragma-vs-migration, naive live-file copying — all covered above; nothing new.

### 5. Alternatives

- **Elysia**: throughput edge is Bun-specific (AOT targets Bun internals); on Node the edge evaporates. No swap.
- **Fastify**: selling points (plugin ecosystem, schema-first validation at scale) not load-bearing for 6 routes; framework overhead dwarfed by DB time either way. No swap.
- **Raw SQL over Drizzle**: workable, but every reference project uses Drizzle + better-sqlite3 without ORM-layer friction — all reported pain was Docker/pragma/native-module, never Drizzle. Generated `.sql` migrations + type safety are real value. No swap.

### Carry into implementation

1. Base image `node:22-bookworm-slim`, both stages.
2. Boot sequence: open DB → pragmas → `migrate()` (FK off/on wrap + `foreign_key_check`, hard-exit on failure) → `serve()`.
3. Backup: Litestream or `VACUUM INTO`, never `cp` the live file → Ops grill.
