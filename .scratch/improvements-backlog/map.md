# Improvements audit — 2026-08-22

A six-lens audit of the shipped v1 (client bugs, server bugs/security, UI/UX, log-path friction, competitor research, zero-UI capture research), verified against the code, then ranked. Branch: `feature/improvements`.

18 raw findings → 11 shipped, 3 deferred (below), 2 rejected.

## Shipped

Seven commits, `35c69fb..de80e6e`. Read the commit messages for the reasoning; each one states the failure it fixes.

| Commit | What |
|---|---|
| `35c69fb` | A failed live tap-to-log never retried; the documented rehydration overlay was never built |
| `24e153d` | Login route had no body size cap; rate limiter's Map never evicted |
| `b6b1868` | No `env(safe-area-inset-*)` anywhere, on a standalone iOS PWA with `viewport-fit=cover`; placeholder contrast under AA |
| `f673e97` | List row urgency was colour-only, contradicting `ListRowItem`'s own comment |
| `47d9118` | Log sheet unreachable by keyboard; pending chip announced nothing |
| `4fd04a5` | Creating a Tracker left you on a screen that can't show it |
| `de80e6e` | `LAPSE_API_TOKEN` + Telegram bot — see `docs/capture.md` |

## Decisions so far

- **Capture: Shortcuts first, Telegram second, both shipped.** The blocker was never the API — `POST /entries` has been idempotent since v1. It was auth: Shortcuts cannot capture and replay a `Set-Cookie`, so cookie-only auth put the API out of reach of everything but the app. One bearer token unlocked both paths. Shortcuts on the Action Button is fewer steps; the bot's list is built from the database so it cannot go stale, and works off-iPhone. Full reasoning in `docs/capture.md`.
- **`LAPSE_API_TOKEN` is deliberately not `LAPSE_PASSWORD`.** The password's protection is living in an httpOnly cookie nothing reads back out. A token pasted into a Shortcut travels with that Shortcut on every export or share.
- **Long polling, not a webhook.** A webhook needs lapse to know its own public URL, register it at boot, and verify a second shared secret on an unauthenticated route. `getUpdates` needs the bot token and nothing else.
- **Entry creation moved to `src/server/entryWrites.ts`.** Two callers now write Entries, and the rules they must agree on (idempotency, the future-`occurredAt` clamp) are the ones that fail silently when they drift.
- **The bot's poll loop is not unit-tested**, by the same reasoning `docs/tech-stack.md` § Testing gives for SW glue. Everything it decides is. Verified by hand against a real bot token.

## Rejected

- **Long-press and swipe have no discoverability affordance.** A deliberate tradeoff against the quiet-ledger direction, on an app whose single user learns the gesture once. Nothing to ship.
- **Reuse `LAPSE_PASSWORD` as the bearer token.** Folded into `de80e6e`'s design as the reason it mints a separate secret, rather than shipped and then walked back.

## Fog

- Nobody has used the Telegram bot against a real chat yet — only against a real token with an invalid credential, which proved the failure path. First real `/start` is still unverified.
- Whether the six-tile quick-log digest actually strands anything is unknown until the tracker list grows. See issue 01.
