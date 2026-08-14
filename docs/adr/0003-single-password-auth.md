# Single-password auth, no user accounts

There is no users table. Auth is one password from the `LAPSE_PASSWORD` env var, checked at login, granting a long-lived (1 year) httpOnly session cookie. If the env var is unset, auth is disabled entirely (trusted-LAN/Tailscale mode). Lapse is single-user by design (see v2 checklist for the multi-user question); accounts, roles, and password reset flows are complexity with no customer.
