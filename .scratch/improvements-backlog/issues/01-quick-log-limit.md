# 01 — Widen the quick-log digest if recency strands something

**What to build:** Nothing yet. One constant, when the symptom shows up.

**Blocked by:** None. Waiting on evidence, not on work.

**Status:** needs-info

`selectQuickLogRows.ts` shows six tiles ranked purely by recency, because bootstrap carries each row's latest Entry and no frequency count. Recency as a frequency proxy is a documented, deliberate call (build ticket 10) tied to keeping launch at one round trip.

The failure mode it implies: a Tracker you log often but not *recently* falls off the digest the moment six other rows are fresher, and Home stops offering the thing you actually reach for.

**The trigger:** you notice a genuinely frequent Tracker missing from the Home quick-log grid.

**Then:** bump `QUICK_LOG_LIMIT` from 6 to 8–10 in `src/client/home/selectQuickLogRows.ts`. One line, no plumbing.

Do not pre-emptively add frequency counts to the bootstrap payload to "fix" the ranking. That trades the single launch round trip for a problem nobody has reported.
