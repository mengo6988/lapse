---
name: animation-review
description: Motion review for the lapse client. Fire when asked what animations or interaction feedback to add, when a surface that appears or disappears ships (sheet, toast, chip, dialog), or when existing motion needs checking against the house rules.
---

# Animation review

Review the client for motion: where feedback is missing, where it breaks a rule below, and where it must stay instant on purpose. The deliverable is a classified survey of state changes, never a pile of suggestions.

## Sources of truth

Read these first; they outrank this file where they differ.

- `docs/design.md` § Motion holds the philosophy. Quiet ledger: motion confirms an action or preserves continuity. Decoration is a finding.
- `src/client/styles/tokens.css` holds the only sanctioned durations and easings (`--duration-*`, `--ease-*`). A magic number in component CSS is a finding.
- `src/client/styles/base.css` collapses everything under `prefers-reduced-motion`. Component CSS leans on that instead of repeating the media query.
- `src/client/shell/useExitTransition.ts` is the exit pattern. Its doc comment explains why unmounts are timer-driven, and why its constant must match `--duration-fade`.

## Process

1. Enumerate every element on the surfaces under review that appears, disappears, or changes visual state. Grep for conditional renders (`&& (`, `? null`), store subscriptions, and `animation:` / `transition:` in the colocated CSS.
2. Classify each state change into exactly one bucket:
   - **animated**: has motion. Check it against every rule below.
   - **deliberately instant**: no motion, and a rule says so. Name the rule.
   - **opportunity**: no motion and no rule protects it. Name the pattern and the tokens to use.
3. Rank opportunities by how jarring the instant change is: a full surface popping in beats a chip blinking beats a color snap.
4. Report the whole classification. The deliberately-instant entries are what prove the sweep happened; a report of only opportunities is an unfinished review.

Done means every state change sits in one bucket and every animated entry was checked against every rule.

## Rules

### The frequency rule

Actions performed tens of times a day get no added motion. Tap-to-log is the app's most frequent action; its 340ms settle is the write confirmation and is already the whole budget. More motion on that path is a finding, not an opportunity.

### Easing

`--ease-standard` (a strong ease-out) for anything entering or leaving, `--ease-sheet` for the bottom sheets, `--ease-spring` only for the log settle. Ease-out accelerates into view, so the element is present for the moment the user is watching; ease-in spends that moment ramping up, which is why no rule here ever calls for it.

### Duration

Under 300ms for everything except the sheet enter and the settle (340ms, sanctioned in design.md). Exits run faster than enters: sheets arrive at `--duration-settle` and leave at `--duration-fade`. Dismissal reads as release, not choreography.

### Properties

Animate `transform` and `opacity` only; they composite on the GPU. Height, top, padding, and margin reflow every frame.

### Scale

Enter from 0.9 to 0.97, so elements settle rather than materialize. Press feedback is `scale(0.94)` to `scale(0.98)` on `:active` at `--duration-press` (see `.tab-bar` and the login button).

### Exit pattern

A React unmount removes the node before CSS can play. `useExitTransition` latches the last open value for 200ms after the owning store flips closed; the consumer renders the latched value with a `--closing` or `--out` class whose keyframe ends in `forwards`. Close paths stay untouched and focus restores instantly; only the DOM lingers. Canonical consumers: `TrackerSheetHost`, `LogSheetHost`, `LogToast`, `PendingChip`, `TrackerDetailScreen`.

```tsx
const { value, closing } = useExitTransition(state.kind === 'closed' ? null : state)
if (value === null) return null
return <div className={closing ? 'toast toast--out' : 'toast'}>{value.message}</div>
```

```css
.sheet {
  animation: sheet-in var(--duration-settle) var(--ease-sheet);
}
.sheet--closing {
  animation: sheet-out var(--duration-fade) var(--ease-sheet) forwards;
}
@keyframes sheet-in { from { transform: translateY(100%); } }
@keyframes sheet-out { to { transform: translateY(100%); } }
```

Anything interactive inside a closing element needs a staleness check: `LogToast` hides undo the moment the store closes, and `LogSheetHost` submits against the live store, never the latch.

### Interruptibility

Motion the user can reverse mid-flight (a drag, a toggle) uses transitions, which reverse from wherever they are. One-shot confirmations (settle, toast, enter, exit) use keyframes.

### Reduced motion

Lean on the global collapse in base.css. Exit keyframes carry `forwards` so the collapsed animation still ends hidden instead of leaving a ghost for the latch's 200ms.

### Announcements

Motion never substitutes for accessibility. Anything appearing as feedback keeps its live region (`LogToast`, `PendingChip`), canonical strings from design.md stay intact, and state that must be readable without color goes in `aria-label`.

## Settled questions

Re-deriving these wastes a review. Gesture discoverability affordances were rejected as a quiet-ledger tradeoff (`.scratch/improvements-backlog/map.md`). Staggered list entrances and route transitions lose to "no attention-grabbing loops". Web haptics are dead on iOS: `navigator.vibrate` is blocked and Apple patched the checkbox-switch workaround in iOS 26.5.
