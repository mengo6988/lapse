# Lapse — Grill Checklist

What's settled and what still needs a dedicated grilling session before/while building.

## Done

- [x] **Product & scope grill** (2026-08-14) — core loop, domain model, v1 cut line → `docs/spec.md`, `CONTEXT.md`
- [x] **Tech stack grill** (2026-08-14) — single container, Hono + Vite React + SQLite, offline-lite, auth → `docs/tech-stack.md`, ADR-0001..0003
- [x] **Competitive research** (2026-08-14) — findings folded into spec.md and design.md
- [x] **iOS/PWA research** (2026-08-14) — folded into tech-stack.md

## Pending

- [ ] **UI/UX deep grill** — visual language (commit to a non-generic direction), wireframes per screen, palette + dark mode tokens, motion/animation, empty states, error states. Load `design-quality` + `interface-kit` skills for this session.
- [ ] **Schema & API review grill** — walk the Drizzle schema + endpoints in `docs/spec.md` before first migration; settle pagination, cascade rules, the variantless-entries edge case.
- [ ] **Offline-lite implementation grill** — outbox replay order, dedup/idempotency details, clock skew on backdated offline entries, "pending sync" UX, SW update prompt behavior.
- [ ] **v1.1 notifications grill** (after v1 ships) — ntfy topology (hosted vs self-hosted), check frequency, re-notify policy (once vs daily nag), per-tracker config.
- [ ] **Branding grill** — app icon, name treatment, tone of copy ("logged ✓" voice).
- [ ] **Ops grill** — Docker image size budget, healthcheck, SQLite backup automation (litestream?), Tailscale serve config.
