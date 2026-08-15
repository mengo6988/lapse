# Testing strategy grill

Type: grilling
Status: resolved

## Question

Settle test tooling and scope before build, honoring the global TDD + 80% coverage rules: runner (Vitest presumably), React testing approach, API/integration test shape against better-sqlite3 (in-memory?), whether v1 gets E2E (Playwright) or defers it, and coverage gate wiring. Output: short testing section in `docs/tech-stack.md`.

## Answer

Resolved 2026-08-15, single grill round of 6 questions — all settled per recommendation:

1. **Runner**: Vitest, one config with two projects — `client` (jsdom) + `server` (node). One `npm test`, one merged coverage report.
2. **React approach**: Testing Library + jsdom with thin component tests (wiring only: tap logs, undo toast, chip filtering). Ratio/sort/observed-interval/suggestion logic extracted into pure modules that carry most coverage as plain unit tests. Vitest browser mode rejected.
3. **API integration**: Hono `app.request()` in-process (no HTTP server) against better-sqlite3 `:memory:`, Drizzle migrations in suite setup, fresh DB per test file. Covers routes, Zod validation, idempotency, occurredAt clamp.
4. **Outbox/offline**: outbox module fully unit-tested with `fake-indexeddb` + stubbed `fetch` (drain order, backoff, dead-letter, undo, rehydration overlay). SW itself untested (vite-plugin-pwa output); registration glue excluded from coverage.
5. **E2E**: in v1, thin Playwright smoke — 2–3 journeys against built app + real server + temp SQLite file (create→tap-log→fresh, long-press log, archive). No SW/offline simulation in E2E; deferral option rejected.
6. **Coverage gate**: `@vitest/coverage-v8`, 80% thresholds (lines/functions/statements/branches) in Vitest config so `vitest run --coverage` fails anywhere. Exclusions: entrypoints, SW registration glue, migrations, config files. CI wiring deferred to the Ops grill.

**Docs updated**: `docs/tech-stack.md` (new § Testing).
