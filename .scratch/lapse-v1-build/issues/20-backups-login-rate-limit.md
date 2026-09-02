# 20 — Backups and login rate limit

**What to build:** The two things that make a public single-password deployment survivable: recoverable data and a login that cannot be brute-forced.

**Blocked by:** 02 (Docker image and first deploy).

**Status:** resolved

- [x] A daily job writes a consistent backup with `VACUUM INTO` to a backups directory on the data volume — never a copy of the live database file — and prunes to the newest 7
- [x] A restore drill is performed once: open a backup copy, verify the data reads, and record how it was done
- [x] The login route is rate limited to a fixed window of 10 attempts per 15 minutes, keyed on the first `X-Forwarded-For` hop; other routes are unaffected
- [x] Tests cover the limiter window boundary and the key extraction (including a spoofed multi-hop header)

Deviation worth a decision: the limiter keys on the LAST `X-Forwarded-For` hop, not the first. `docs/tech-stack.md` and ADR-0003 both say "the first hop", but they also say "(set by Traefik)" — and Traefik appends its observed peer address to the end of whatever header arrived rather than replacing it, so the hop Traefik sets is the last one. Reading index 0 literally would let a client bypass the limiter by varying a self-chosen leading hop on every attempt. The implementation follows the stated intent; the doc wording is the part that is factually wrong and should be corrected to "last hop" or "the hop nearest Traefik".

The restore drill proved the backup file itself: real migrations, real schema, rows seeded and read back from a fresh read-only connection against the backup alone. The full swap-a-backup-in-and-reboot path was not drilled end to end.
