/**
 * The edit path for an existing Entry (docs/design.md § Tracker detail /
 * history: "Tap → edit sheet (same fields as log sheet) + delete"). Ticket
 * 13's log sheet (creating a *new* Entry) hasn't landed yet — this is
 * self-contained rather than waiting on it, reusing only what already
 * exists: `TrackerSheet` for the dialog chrome and `useFocusTrap` for
 * focus handling (both imported from src/client/tracker, not edited).
 *
 * Field shape (time / duration / note) matches docs/design.md's log sheet
 * spec so ticket 13 can share the chip-and-input pattern here if useful —
 * the concrete markup isn't exported for reuse since the two sheets differ
 * in one meaningful way: this one edits an *existing* occurredAt (so "now"
 * here means "move this Entry to now", not "log a new one").
 */
import { useState, type FormEvent } from 'react'
import type { Entry } from '../api'
import { FieldError } from '../tracker/FieldError'
import { TrackerApiError } from '../tracker/mutationClient'
import { TrackerSheet } from '../tracker/TrackerSheet'
import { useFocusTrap } from '../tracker/useFocusTrap'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from './datetimeLocal'
import { useDeleteEntry } from './useDeleteEntry'
import { useUpdateEntry } from './useUpdateEntry'

export interface EntryEditSheetProps {
  entry: Entry
  trackerId: string
  onClose: () => void
  /** captured by the caller at the moment the sheet was opened, e.g. the row button that triggered it — see useFocusTrap's doc comment for why this can't be read here. */
  openedFrom?: HTMLElement | null
  /** true while the caller plays the exit animation — see src/client/shell/useExitTransition.ts. */
  closing?: boolean
}

function isoMinusMs(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

const DURATION_CHIPS = [15, 30, 60] as const

export function EntryEditSheet({ entry, trackerId, onClose, openedFrom, closing = false }: EntryEditSheetProps) {
  const [occurredAtLocal, setOccurredAtLocal] = useState(toDatetimeLocalValue(entry.occurredAt))
  const [durationMinutes, setDurationMinutes] = useState(entry.durationMinutes != null ? String(entry.durationMinutes) : '')
  const [note, setNote] = useState(entry.note ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | undefined>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | undefined>()

  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()

  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose, openedFrom)

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError(undefined)

    const occurredAt = fromDatetimeLocalValue(occurredAtLocal)
    if (occurredAt === null) {
      setFieldErrors({ occurredAt: 'enter a valid time' })
      return
    }
    const trimmedDuration = durationMinutes.trim()
    const parsedDuration = trimmedDuration === '' ? null : Number(trimmedDuration)
    if (parsedDuration !== null && !Number.isFinite(parsedDuration)) {
      setFieldErrors({ durationMinutes: 'enter a number' })
      return
    }

    updateEntry.mutate(
      { id: entry.id, trackerId, occurredAt, durationMinutes: parsedDuration, note: note.trim() === '' ? null : note.trim() },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (!(error instanceof TrackerApiError)) return
          setFieldErrors(error.fieldErrors)
          setFormError(Object.keys(error.fieldErrors).length === 0 ? error.message : undefined)
        },
      },
    )
  }

  function handleDelete() {
    setDeleteError(undefined)
    deleteEntry.mutate(
      { id: entry.id, trackerId },
      {
        onSuccess: onClose,
        onError: (error) => setDeleteError(error instanceof TrackerApiError ? error.message : undefined),
      },
    )
  }

  return (
    <>
      <div className={closing ? 'tracker-sheet-scrim tracker-sheet-scrim--closing' : 'tracker-sheet-scrim'} onClick={onClose} />
      <TrackerSheet title="edit entry" onClose={onClose} containerRef={containerRef} closing={closing}>
        <form className="entry-edit" onSubmit={handleSave}>
          <div className="entry-edit__field">
            <label htmlFor="entry-edit-time" className="entry-edit__label">
              time
            </label>
            <div className="entry-edit__chips">
              <button type="button" className="entry-edit__chip" onClick={() => setOccurredAtLocal(toDatetimeLocalValue(isoMinusMs(0)))}>
                now
              </button>
              <button type="button" className="entry-edit__chip" onClick={() => setOccurredAtLocal(toDatetimeLocalValue(isoMinusMs(60 * 60 * 1000)))}>
                1h ago
              </button>
              <button type="button" className="entry-edit__chip" onClick={() => setOccurredAtLocal(toDatetimeLocalValue(isoMinusMs(24 * 60 * 60 * 1000)))}>
                yesterday
              </button>
            </div>
            <input
              id="entry-edit-time"
              type="datetime-local"
              className="entry-edit__input"
              value={occurredAtLocal}
              onChange={(event) => setOccurredAtLocal(event.target.value)}
              aria-describedby="entry-edit-time-error"
            />
            <FieldError id="entry-edit-time-error" message={fieldErrors.occurredAt} />
          </div>

          <div className="entry-edit__field">
            <label htmlFor="entry-edit-duration" className="entry-edit__label">
              duration (minutes)
            </label>
            <div className="entry-edit__chips">
              {DURATION_CHIPS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={durationMinutes === String(minutes) ? 'entry-edit__chip entry-edit__chip--active' : 'entry-edit__chip'}
                  aria-pressed={durationMinutes === String(minutes)}
                  onClick={() => setDurationMinutes(String(minutes))}
                >
                  {minutes}m
                </button>
              ))}
              <button type="button" className="entry-edit__chip" onClick={() => setDurationMinutes('')}>
                clear
              </button>
            </div>
            <input
              id="entry-edit-duration"
              type="number"
              inputMode="numeric"
              min={1}
              className="entry-edit__input"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              aria-describedby="entry-edit-duration-error"
            />
            <FieldError id="entry-edit-duration-error" message={fieldErrors.durationMinutes} />
          </div>

          <div className="entry-edit__field">
            <label htmlFor="entry-edit-note" className="entry-edit__label">
              note
            </label>
            <textarea
              id="entry-edit-note"
              className="entry-edit__textarea"
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby="entry-edit-note-error"
            />
            <FieldError id="entry-edit-note-error" message={fieldErrors.note} />
          </div>

          {formError && (
            <p className="entry-edit__error" role="alert">
              {formError}
            </p>
          )}

          <div className="entry-edit__actions">
            <button type="submit" className="entry-edit__save" disabled={updateEntry.isPending} aria-busy={updateEntry.isPending}>
              save
            </button>
          </div>
        </form>

        <div className="entry-edit__delete-section">
          {!confirmingDelete ? (
            <button type="button" className="entry-edit__delete-trigger" onClick={() => setConfirmingDelete(true)}>
              delete entry
            </button>
          ) : (
            <>
              <p className="entry-edit__delete-copy">delete this entry? this can&apos;t be undone.</p>
              <div className="entry-edit__delete-actions">
                <button type="button" className="entry-edit__delete-cancel" onClick={() => setConfirmingDelete(false)}>
                  cancel
                </button>
                <button
                  type="button"
                  className="entry-edit__delete-confirm"
                  onClick={handleDelete}
                  disabled={deleteEntry.isPending}
                  aria-busy={deleteEntry.isPending}
                >
                  delete
                </button>
              </div>
            </>
          )}
          {deleteError && (
            <p className="entry-edit__error" role="alert">
              {deleteError}
            </p>
          )}
        </div>
      </TrackerSheet>
    </>
  )
}
