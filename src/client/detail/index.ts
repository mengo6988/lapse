/**
 * Public entry points for src/client/detail/. `TrackerDetailRoute` is
 * mounted once at the `/tracker/:trackerId` route in AppShell (already
 * wired). `SwipeRevealRow`/`useSwipeReveal` are the reusable swipe-to-reveal
 * piece build ticket 15 was asked to make self-contained: the only place
 * they need to be wired in is src/client/list/ListRowItem.tsx, which this
 * ticket does not own — see the ticket's implementation notes for the exact
 * integration point.
 */
export { TrackerDetailRoute } from './TrackerDetailRoute'
export { SwipeRevealRow } from './SwipeRevealRow'
export type { SwipeRevealRowProps } from './SwipeRevealRow'
export { useSwipeReveal } from './useSwipeReveal'
export type { SwipePoint, UseSwipeRevealOptions, UseSwipeRevealResult } from './useSwipeReveal'
