/**
 * Reorders (and re-filters) `liveRows` to the id order captured in a freeze
 * snapshot (src/client/log/computeFreezeSnapshot.ts) instead of recomputing
 * order from scratch. Build ticket 12: "row order is frozen for the duration
 * of the undo window" — membership AND order both come from `frozenIds`; the
 * data on each returned row still comes from `liveRows`, so a just-logged
 * row shows its fresh state (green, "now") in the slot it already occupied,
 * rather than a stale copy of its pre-tap self. A frozen id missing from
 * `liveRows` (e.g. the Tracker was deleted mid-window) is silently dropped;
 * a live row missing from `frozenIds` is never appended — membership stays
 * frozen too, matching the accepted prototype
 * (.scratch/lapse-v1/assets/12-home-prototype.html).
 */
export function applyFrozenOrder<T>(
  liveRows: readonly T[],
  frozenIds: readonly string[],
  getId: (row: T) => string,
): T[] {
  const byId = new Map(liveRows.map((row) => [getId(row), row]))
  const frozen: T[] = []
  for (const id of frozenIds) {
    const row = byId.get(id)
    if (row !== undefined) frozen.push(row)
  }
  return frozen
}
