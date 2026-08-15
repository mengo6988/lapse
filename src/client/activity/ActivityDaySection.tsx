/**
 * One device-local day's worth of Activity rows (build ticket 21
 * acceptance criterion: "Entries are day-bucketed in device-local time").
 * A `<h2>` heading + its own `<ul>` per day, not a nested `<section>` —
 * a landmark region per day would spam the accessibility tree once a feed
 * spans more than a couple of days. Label styling matches
 * src/client/home/SlippingSection.tsx's `slipping__label` (italic serif
 * section label), the closest visual precedent for "a small heading above
 * a group of rows" in this direction (docs/design.md § Type).
 */
import { Fragment } from 'react'
import { ActivityEntryRow } from './ActivityEntryRow'
import type { ActivityRow } from './activityRows'
import type { DaySection } from './dayBuckets'

export interface ActivityDaySectionProps {
  section: DaySection
  onOpenEntry: (row: ActivityRow) => void
}

export function ActivityDaySection({ section, onOpenEntry }: ActivityDaySectionProps) {
  return (
    <Fragment>
      <h2 className="activity-day__label">{section.label}</h2>
      <ul className="activity-day__rows">
        {section.rows.map((row) => (
          <ActivityEntryRow key={row.id} row={row} onOpen={onOpenEntry} />
        ))}
      </ul>
    </Fragment>
  )
}
