# 22 — Settings screen

**What to build:** The small pile of things that need somewhere to live: managing Categories, reaching the archive, and logging out. Designed in-build on the committed tokens.

**Blocked by:** 06 (Categories CRUD and bootstrap payload), 09 (Design tokens and app shell), 16 (Archived view).

**Status:** resolved

- [x] Categories manager: add, rename, recolor, delete — with the delete confirmation stating that its Trackers become uncategorised rather than disappearing
- [x] An entry point to the archived list
- [x] Logout clears the session cookie and returns to the login screen, leaving no cached data readable behind it
- [x] The screen is a composition of existing components and tokens — no new visual language introduced

## Implementation notes

**Logout endpoint:** `POST /api/auth/logout` → `200 { ok: true }`, always. Registered *above* the `/api/*` session guard, so it succeeds even against a missing or already-stale cookie and the client is never trapped in a broken session. It calls the existing `clearSession` helper in `src/server/auth.ts`, which had been written for exactly this and was until now unused. Written into `docs/spec.md` § API.

There is no server-side session store — the cookie is a deterministic HMAC of the password (ADR-0003) — so logout only forgets the browser's copy; it cannot revoke a token someone else captured. That is a pre-existing property of the auth design, not something this ticket introduced.

**Client logout** (`settings/useLogout.ts`) always runs three local steps whether or not the network call succeeded, since logging out must never be blocked by being offline: clear the in-memory query cache, delete the persisted IndexedDB snapshot, then `session.markUnauthorized()`. Order matters on the last one — `apiFetch` marks the session *authed* on any 2xx, so flipping to unauthorized before the call settles would be undone by the logout's own success response.

**Files added** (all under `src/client/settings/`, replacing the placeholder `SettingsRoute.tsx`): `categoryCache.ts` (add/patch/remove, where remove also nulls `categoryId` on every affected Tracker to mirror the server's `on delete set null`), `useCreateCategory.ts` / `useUpdateCategory.ts` / `useDeleteCategory.ts`, `useLogout.ts`, `color.ts`, `CategoriesManager.tsx`, `CategoryRow.tsx`, `AddCategoryForm.tsx`, `CategoryDeleteDialog.tsx`, `LogoutButton.tsx`, `settings.css`.

## Post-agent integration notes

**Defect found and fixed after the agent finished:** the Category recolor fired one `PATCH /categories/:id` per pointer move.

`CategoryRow` committed the colour from the `<input type="color">`'s React `onChange`, with a comment reasoning that the native picker's own close is the confirm gesture. That is true of the DOM `change` event, but React lists `color` among its text-input types and routes **both** `input` and `change` to `onChange` — and a native colour picker fires `input` continuously while the user drags through the gradient. Dragging to a colour would therefore have written dozens of rows to the database for a single pick.

Fixed by keeping a `draftColor` so the swatch still tracks the drag, and committing only when `event.nativeEvent.type === 'change'` (plus skipping a picker dismissed on the colour it opened with). Three tests added: no PATCH during a drag, exactly one for a drag that ends in a confirmed pick, none for a no-op pick.

**Cleanup:** `routes/RouteStub.tsx`, `routes/RouteStub.test.tsx` and `styles/route-stub.css` were deleted — this ticket and 21 replaced the last two stubs, leaving them dead. `shell/AppShell.test.tsx`'s two "reaches the honest stub" tests now assert the real screens instead.

**Decisions the agent made that are worth a second look:** rename commits on blur (a blank blur reverts rather than erroring); the new-Category default swatch is lavender `#b4befe` rather than one of the four seeded colours; the delete confirmation reuses the destructive red styling even though only the Category itself is destroyed.
