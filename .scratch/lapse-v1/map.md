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
- [Single-password auth (ADR-0003)](../../docs/adr/0003-single-password-auth.md) — `LAPSE_PASSWORD` env, 1-year cookie (amended by Ops grill: password now required, public deployment)
- [Tech stack](../../docs/tech-stack.md) — Vite + React SPA, TanStack Query, Hono on Node 22, better-sqlite3 + Drizzle, vite-plugin-pwa
- [Design principles + screens](../../docs/design.md) — zero-friction write, glanceable read, urgency accents, screen inventory

<!-- Map tickets append below as they resolve -->

- [Stack validation research](issues/01-research-stack-validation.md) — keep the stack; use `node:22-bookworm-slim` both Docker stages, WAL + NORMAL + busy_timeout 5000 pragmas, FK-wrap around migrate-on-boot; never copy the live db file (Litestream or `VACUUM INTO`)
- [iOS PWA update & offline behavior research](issues/02-research-ios-pwa-update-offline.md) — iOS won't update SW mid-session; adopt periodic `registration.update()` + `immediate: true` + `vite:preloadError` reload + no-cache headers on sw.js/index.html; persist query cache to IndexedDB (`idb-keyval`), not localStorage; all client storage is disposable — server is record of truth
- [Outbox implementation research](issues/03-research-outbox-implementations.md) — hand-rolled ~100-line outbox in IndexedDB (UUIDv7 ids, serial drain, exponential backoff + jitter); TanStack mutation persistence rejected (reload/race/parallel-replay footguns); Background Sync API unsupported on iOS, replay is foreground-only
- [UI direction reference research](issues/04-research-ui-direction-references.md) — 10 named references (Flighty, Teenage Engineering, Tody, Planta, Timepage, split-flap boards…); three packaged directions for the UI/UX grill: "Departure Board" / "Studio Mono" / "Warm Ledger"; accent-on-neutral OKLCH token rules; tap-to-log motion timings
- [Feature re-scope grill](issues/05-grill-feature-rescope.md) — pulled into v1: observed-interval line, threshold suggestions, per-Variant Threshold override (`variants.thresholdDays` nullable, null inherits), home search; export + notifications + rest stay v2; no new tickets — mechanics settled in-round, detail absorbed by the UI/UX and Schema & API grills; `docs/spec.md` + `docs/v2-checklist.md` updated
- [Schema & API review grill](issues/07-grill-schema-api.md) — UUIDv7 text PKs + ISO-text timestamps everywhere; variant delete = soft delete (`deletedAt`, history keeps its label); cursor pagination; bootstrap payload shape fixed; Zod validation rules per endpoint; archived trackers accept outbox-replayed entries; indexes + `/api/health` added; spec's data-model + API sections rewritten, ready for first Drizzle schema
- [UI/UX direction grill](issues/06-grill-uiux-direction.md) — committed "ledger × catppuccin mocha" (frames 3a home digest + 3b list); mocha tokens + serif/mono type + accent-bar urgency; bottom tab bar with center FAB supersedes FAB-bottom-right; reference markup in [assets/06-chosen-direction-ledger-mocha.html](assets/06-chosen-direction-ledger-mocha.html); `docs/design.md` rewritten — unblocks Branding grill + Home screen prototype
- [Offline-lite implementation grill](issues/08-grill-offline-lite.md) — hand-rolled IndexedDB outbox, `POST /entries` only; serial UUIDv7 drain, exp backoff + jitter, 4xx dead-letter with manual retry; server clamps future `occurredAt` (spec amended); query cache persists to IndexedDB; silent SW auto-update, no prompt (closes the SW-prompt fog line); header pending chip + queued sheet; implementation contract in `docs/tech-stack.md`, ADR-0002 amended

- [Testing strategy grill](issues/09-grill-testing-strategy.md) — Vitest two-project config (client jsdom / server node); pure-module unit tests carry coverage, thin Testing Library component tests; Hono `app.request()` + `:memory:` SQLite integration; outbox unit-tested via `fake-indexeddb`, SW untested; thin Playwright smoke (2–3 journeys) in v1; 80% coverage thresholds in Vitest config, CI wiring left to Ops grill; new § Testing in `docs/tech-stack.md`
- [Ops grill](issues/10-grill-ops.md) — deploy target is a **public domain** (`lapse.mengo.dev` behind existing Traefik on the Contabo VPS), not Tailscale-only; auth hardened (password required, timing-safe compare, Secure cookie, login rate limit — ADR-0003 amended); daily `VACUUM INTO` backups, prune 7; bookworm-slim multi-stage image, node HEALTHCHECK; build-on-VPS deploy via compose, no registry; no CI in v1 (explicit override); § Ops in `docs/tech-stack.md`
- [Branding grill](issues/11-grill-branding.md) — lowercase "lapse" in-product, capitalized "Lapse" on OS surfaces (manifest/home-screen); icon = serif "l" + lavender underline bar on base, SVG source + sharp-generated PNG set; terse lowercase copy voice with canonical-strings table; § Branding in `docs/design.md`
- [Home screen prototype](issues/12-prototype-home-screen.md) — interactive prototype in [assets/12-home-prototype.html](assets/12-home-prototype.html), accepted as-is: logged card lingers green through the 5s undo window then re-sorts on a fade; home magnifier routes to list with search open; header sliders icon dropped (magnifier only); 450ms long-press; `docs/design.md` + spec search wording updated

## Not yet specified

(empty — all fog graduated. Activity + settings layouts and the handoff shape both live in the [Build handoff grill](issues/13-grill-build-handoff.md), the last open ticket.)

## Out of scope

- **Notifications v1.1 (ntfy)** — deferred until v1 ships (`docs/v2-checklist.md`); returns as its own effort. The Feature re-scope grill is the only sanctioned door back in.
- **Remaining v2-checklist items** (stats, NFC, widgets, multi-user, export UI, full sync engine) — same rule: out unless the re-scope grill explicitly pulls one in.
