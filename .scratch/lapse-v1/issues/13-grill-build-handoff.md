# Build handoff grill

Type: grilling
Status: resolved

## Question

Package the finished plan for implementation — the map's final ticket. Decide: milestone/phase order for the v1 build (schema → API → outbox → UI? vertical slices?), the task breakdown granularity and where it lives, the TDD entry point per the global workflow (which test suite starts first), and where the activity + settings screens get their design pass (expected: in-build, extending the committed ledger × mocha tokens — graduated fog from the Home screen prototype). Output: a build-plan doc (or spec addendum) an implementation effort can start from without reopening any decision.

## Answer

Resolved 2026-08-15, one grill round of 6 questions, all per recommendation:

1. **Milestone order**: walking skeleton then thin horizontal layers — M0 skeleton (scaffold, test rig, boot, auth, Docker, first deploy), M1 core CRUD (schema + all endpoints + integration tests), M2 read UI, M3 write UI, M4 offline-lite + PWA, M5 ship. Strict vertical slicing rejected: dumb-CRUD API + client-owned logic means layers are already thin.
2. **Handoff artifact**: `docs/build-plan.md` — milestones as committed checklists, single source for the implementation effort. A scratch tracker can spawn later only if a milestone needs decomposition.
3. **TDD entry point**: two first RED tests in M0, one per Vitest project — server `GET /api/health` via `app.request()`, client urgency ratio/state pure module. Every later milestone starts from a working rig.
4. **Activity + settings design**: in-build during M5, extending the committed tokens; no pre-build mock (screens are compositions of existing components).
5. **First deploy timing**: end of M0 — the password-gated skeleton deploys to `lapse.mengo.dev` so Docker/Traefik/DNS surprises surface in week one.
6. **Map closure**: `.scratch/lapse-v1/` freezes as archive; map records destination reached, pointing at the build plan; implementation runs as its own effort, no wayfinder unless real fog appears.

**Docs updated**: `docs/build-plan.md` created (the handoff artifact).
