# lapse v1 — build tickets

Implementation tickets for the v1 build, decomposed from `docs/build-plan.md`. The build plan remains the source of the milestone shape and the per-milestone done-criteria (checklist complete, both Vitest projects green with coverage thresholds, still builds and deploys); these tickets are the takeable units inside it.

Every decision these tickets rely on is already settled in `docs/spec.md`, `docs/tech-stack.md`, `docs/design.md`, and `docs/adr/`. Implementation must not reopen them. Workflow is TDD: RED, GREEN, REFACTOR.

Interaction reference: `.scratch/lapse-v1/assets/12-home-prototype.html`. Visual reference: `.scratch/lapse-v1/assets/06-chosen-direction-ledger-mocha.html`. Both live in the frozen wayfinder archive.

## Frontier

A ticket is takeable when every ticket in its **Blocked by** line is `Status: resolved`. Claim by setting `Status: claimed` before any work; resolve by appending an `## Answer` section and setting `Status: resolved`.

| # | Ticket | Milestone | Blocked by |
|---|--------|-----------|------------|
| 01 | Walking skeleton (local) | M0 | — |
| 02 | Docker image and first deploy | M0 | 01 |
| 03 | Schema, migrations, and category seed | M1 | 01 |
| 04 | Trackers and Variants endpoints | M1 | 03 |
| 05 | Entries and history endpoints | M1 | 03 |
| 06 | Categories CRUD and bootstrap payload | M1 | 03 |
| 07 | Pure domain modules | M2 | 01 |
| 08 | Query layer with persisted cache | M2 | 06 |
| 09 | Design tokens and app shell | M2 | 01 |
| 10 | Home digest | M2 | 07, 08, 09 |
| 11 | List tab | M2 | 07, 08, 09 |
| 12 | Tap-to-log | M3 | 05, 10, 11 |
| 13 | Long-press log sheet | M3 | 12 |
| 14 | Create and edit Tracker, archive | M3 | 04, 09 |
| 15 | Tracker detail and history | M3 | 05, 07, 11 |
| 16 | Archived view | M3 | 14 |
| 17 | Offline outbox | M4 | 12 |
| 18 | PWA and branding assets | M4 | 02 |
| 19 | Pending chip and queued sheet | M4 | 17 |
| 20 | Backups and login rate limit | M5 | 02 |
| 21 | Activity screen | M5 | 09, 12 |
| 22 | Settings screen | M5 | 06, 09, 16 |
| 23 | Ship v1 | M5 | 13, 15, 18, 19, 20, 21, 22 |
