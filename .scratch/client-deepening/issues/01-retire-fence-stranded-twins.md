# 01 — Retire the fence-stranded twins

**What to build:** The Activity feed and the Tracker detail history both scroll to load more, and both parse Entries off the wire. Today each has its own private copy of the machinery. After this ticket there is one infinite-scroll sentinel and one Entry wire schema, and both screens behave exactly as they do now.

**Blocked by:** None — can start immediately.

**Status:** resolved

Mechanical: no design decisions remain in this one. It clears duplicates the later deepenings would otherwise have to route around.

- [x] One infinite-scroll sentinel module exists in a shared location; the byte-identical second copy and its test file are deleted
- [x] Both the Activity feed and the Tracker detail history import the shared sentinel
- [x] The Entry schema is exported from the module that already defines it for the bootstrap payload
- [x] Both entry-fetching modules import that schema instead of redefining it; the two redundant definitions are gone
- [x] Each entry-fetching module keeps its own route, page-size constant and page type — Detail's smaller page size for a rarely-visited screen survives unchanged
- [x] Header comments that explain why the duplication could not be avoided are deleted along with the duplication
- [x] Activity and Detail screen tests pass unmodified; the Playwright smoke suite passes

## Answer

Shipped in `dc5940e` — refactor: one infinite-scroll sentinel, one Entry schema.
