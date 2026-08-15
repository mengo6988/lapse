# Single-password auth, no user accounts

There is no users table. Auth is one password from the `LAPSE_PASSWORD` env var, checked at login, granting a long-lived (1 year) httpOnly session cookie. Lapse is single-user by design (see v2 checklist for the multi-user question); accounts, roles, and password reset flows are complexity with no customer.

## Amendment 2026-08-15 (Ops grill)

Deployment target changed from Tailscale-only to a **public domain** (`lapse.mengo.dev` behind Traefik on a VPS), so the optional-auth mode is dead:

- `LAPSE_PASSWORD` is **required** — boot validates env and exits when it is unset. The original "unset = auth disabled (trusted-LAN/Tailscale mode)" no longer exists.
- Password comparison uses `crypto.timingSafeEqual`.
- Session cookie is `httpOnly` + `Secure` + `SameSite=Lax`.
- The login route is rate-limited in-app: fixed window, 10 attempts per 15 minutes per IP, in-memory, IP taken from the first `X-Forwarded-For` hop (set by Traefik). No other routes are rate-limited.

The single-password model itself stands — this is the Actual Budget pattern: one password gates the whole app.
