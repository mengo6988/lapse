# 03 — An ntfy notification that logs from its own button

**What to build:** One HTTP action button on each overdue notification, pointing at `POST /entries` with `LAPSE_API_TOKEN`. A small addition to the v1.1 notifications feature, not a project.

**Blocked by:** v1.1 ntfy notifications shipping (`docs/v2-checklist.md`). There is nothing to attach a button to until then.

**Status:** needs-info

This looked like a third capture path during the 2026-08-22 audit and isn't one. An ntfy action button only exists on a notification that was already pushed, so it can't be a persistent menu on the lock screen — it only ever answers "this is overdue, log it now".

Two things to check before building it:

- As of May 2026 the iOS ntfy app does not clear the notification after an HTTP action fires (upstream issue 1728). No visual confirmation the log landed is a poor fit for an app built on instant optimistic feedback. Confirm this is fixed, or accept it.
- The token in `docs/capture.md` grants all of `/api/*`. Putting it in an ntfy action means it also lives wherever ntfy stores that notification. If ntfy is self-hosted alongside lapse that changes little; if it is hosted, weigh it.
