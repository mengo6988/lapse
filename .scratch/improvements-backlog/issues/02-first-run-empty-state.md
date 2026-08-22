# 02 — Starter Trackers on a zero-Tracker Home

**What to build:** `docs/design.md` § Home commits to it: "Empty state: 2–3 suggested starter Trackers, one tap to add." Home currently renders empty sections instead.

**Blocked by:** None. Needs a yes from the user first.

**Status:** needs-triage

Cheap if wanted — a few hardcoded names in `src/client/routes/HomeRoute.tsx` calling `useCreateTracker` directly, no new module.

The reason it was not shipped with the rest of the audit: it pays off exactly once, at first install, on a single-user app the user sets up themselves — and this install already has its Trackers. It is the design doc's promise going unkept in a place nobody will stand again.

**Decide:** keep the promise and build it, or strike the line from `docs/design.md` so the doc stops describing something that isn't there. Either is fine. Leaving it as-is is the only bad option, because the next person to read the design doc will trust it.
