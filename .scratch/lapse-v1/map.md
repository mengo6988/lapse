# Lapse v1 — Wayfinder Map

## Destination

A build-ready v1 plan: every open decision resolved (feature scope re-confirmed, UI/UX direction committed, schema/API reviewed, offline-lite mechanics settled, testing strategy and ops decided), with research findings folded into the docs (`docs/spec.md`, `docs/tech-stack.md`, `docs/design.md`). Implementation starts *after* this map completes, as its own effort.

## Notes

- Vocabulary: `CONTEXT.md` (Tracker / Variant / Entry / Threshold / Category / Overdue / Archive). Use `/domain-modeling` when the model shifts.
- Grilling tickets: always invoke `/grilling` + `/domain-modeling`.
- UI/UX and prototype tickets: load `design-quality` + `interface-kit` skills first.
- Tracker conventions: `docs/agents/issue-tracker.md` (this file's format, ticket format, blocking, claim/resolve).
- Standing preference: settled stack (Hono / Vite React / SQLite / Drizzle) is re-validated by research but swapped only on a concrete failure finding, not preference.
- Plan, don't do — no implementation inside this map (the home-screen prototype ticket is the sanctioned exception, as a reaction artifact).

## Decisions so far

Pre-map decisions from the grilling session of 2026-08-14 (these predate the map; detail lives in the linked docs):

- [Product spec v1](../../docs/spec.md) — features, domain rules, urgency sorting, data model, REST API
- [Single-container self-hosted (ADR-0001)](../../docs/adr/0001-single-container-self-hosted.md) — one Docker image: Hono serves API + built SPA, SQLite on a volume
- [Offline-lite, not a sync engine (ADR-0002)](../../docs/adr/0002-offline-lite-not-sync-engine.md) — SW precache + persisted query cache + localStorage outbox, last-write-wins
- [Single-password auth (ADR-0003)](../../docs/adr/0003-single-password-auth.md) — `LAPSE_PASSWORD` env, 1-year cookie, unset = auth off
- [Tech stack](../../docs/tech-stack.md) — Vite + React SPA, TanStack Query, Hono on Node 22, better-sqlite3 + Drizzle, vite-plugin-pwa
- [Design principles + screens](../../docs/design.md) — zero-friction write, glanceable read, urgency accents, screen inventory

<!-- Map tickets append below as they resolve -->

- [Stack validation research](issues/01-research-stack-validation.md) — keep the stack; use `node:22-bookworm-slim` both Docker stages, WAL + NORMAL + busy_timeout 5000 pragmas, FK-wrap around migrate-on-boot; never copy the live db file (Litestream or `VACUUM INTO`)
- [iOS PWA update & offline behavior research](issues/02-research-ios-pwa-update-offline.md) — iOS won't update SW mid-session; adopt periodic `registration.update()` + `immediate: true` + `vite:preloadError` reload + no-cache headers on sw.js/index.html; persist query cache to IndexedDB (`idb-keyval`), not localStorage; all client storage is disposable — server is record of truth
- [Outbox implementation research](issues/03-research-outbox-implementations.md) — hand-rolled ~100-line outbox in IndexedDB (UUIDv7 ids, serial drain, exponential backoff + jitter); TanStack mutation persistence rejected (reload/race/parallel-replay footguns); Background Sync API unsupported on iOS, replay is foreground-only
- [UI direction reference research](issues/04-research-ui-direction-references.md) — 10 named references (Flighty, Teenage Engineering, Tody, Planta, Timepage, split-flap boards…); three packaged directions for the UI/UX grill: "Departure Board" / "Studio Mono" / "Warm Ledger"; accent-on-neutral OKLCH token rules; tap-to-log motion timings

## Not yet specified

- **Stack-swap decision** — only exists if Stack validation research surfaces a concrete failure; can't be phrased sharper until findings land.
- **Per-feature tickets from re-scope** — the Feature re-scope grill may pull v2-checklist items into v1; each pulled feature graduates to its own decision ticket (schema/UI impact).
- **Build handoff shape** — once all grills close: how the finished plan is packaged for implementation (task breakdown, `/tdd` entry point, milestone order). Sharp only at the end.
- **SW update prompt UX** — likely folds into the Offline-lite grill; graduates to its own ticket only if research shows unexpected depth.

## Out of scope

- **Notifications v1.1 (ntfy)** — deferred until v1 ships (`docs/v2-checklist.md`); returns as its own effort. The Feature re-scope grill is the only sanctioned door back in.
- **Remaining v2-checklist items** (stats, NFC, widgets, multi-user, export UI, full sync engine) — same rule: out unless the re-scope grill explicitly pulls one in.
