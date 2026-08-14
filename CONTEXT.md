# Lapse

Single-user, self-hosted app for answering "when did I last do X?". Optimised for one-tap logging and glanceable reading, not scheduling.

## Language

**Tracker**:
A thing whose occurrences the user records over time (tyre pressure check, vacuuming, period, run). Not necessarily a chore or obligation.
_Avoid_: Task, habit, item, event, reminder

**Variant**:
An independent sub-instance of a Tracker with its own last-done state (tyre pressure → volvo, crv). Shares the parent's Threshold.
_Avoid_: Variance, sub-task, child

**Entry**:
One recorded occurrence: a timestamp, optionally a duration and a note. The verb is **log** ("log an entry").
_Avoid_: Log (as noun), completion, occurrence, record

**Threshold**:
Optional duration attached to a Tracker; when time since the last Entry exceeds it, the Tracker (or Variant) is Overdue. Expressed as a duration ("2 weeks"), stored in days.
_Avoid_: Interval, cadence, schedule, due date

**Overdue**:
State of a thresholded Tracker/Variant whose time since last Entry exceeds its Threshold. Ranked by **ratio** (days since last Entry ÷ Threshold), not absolute days.

**Category**:
Optional user-editable label with a color used to filter the home list (house, car, health). Seeded with presets, fully editable.
_Avoid_: Tag, group, folder

**Archive**:
Hiding a Tracker from the home list while keeping its full Entry history. The primary "removal" action; hard delete is secondary and destructive.
_Avoid_: Delete (for the primary action), hide
