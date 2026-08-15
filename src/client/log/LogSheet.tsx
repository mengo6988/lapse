/**
 * Log sheet content (docs/design.md § Log sheet, build ticket 13): time
 * chips, optional duration chips, an optional note, and a single primary
 * Log button — reached only by long-pressing a row (src/client/log/
 * useLongPress.ts), never by the one-tap path. Rendered inside the shared
 * TrackerSheet chrome by LogSheetHost.tsx, the way EntryEditSheet.tsx
 * (src/client/detail/, read-only) already reuses that same chrome — so this
 * sheet gets the grabber/close/swipe-down-to-dismiss for free instead of
 * reimplementing it.
 *
 * "now" is deliberately *not* frozen at the moment its chip is clicked: an
 * undefined `occurredAt` override lets useLogRow's `logEntry` default it to
 * the actual submit-time now, exactly like a plain tap — so leaving the
 * sheet on "now" and taking a few seconds to add a note still logs at the
 * moment Log is pressed, not the moment the sheet opened. The relative
 * chips (1h ago / yesterday) are resolved against the `now` this component
 * was given, not a fresh `Date.now()` read at submit — see this file's
 * decision note in build ticket 13's final report.
 */
import { useState, type FormEvent } from 'react'
import { FieldError } from '../tracker/FieldError'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from './datetimeLocal'
import type { EntryOverrides } from './useLogRow'

export interface LogSheetProps {
  readonly now: Date
  readonly onSubmit: (overrides: EntryOverrides) => void
}

type TimeMode = 'now' | '1h' | 'yesterday' | 'pick'
type DurationChip = 15 | 30 | 60

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const NOTE_MAX_LENGTH = 500
const DURATION_MIN_MINUTES = 1
const DURATION_MAX_MINUTES = 1440
const DURATION_CHIPS: readonly DurationChip[] = [15, 30, 60]

function chipClass(active: boolean): string {
  return active ? 'log-sheet__chip log-sheet__chip--active' : 'log-sheet__chip'
}

function durationChipLabel(minutes: DurationChip): string {
  return minutes === 60 ? '1h' : `${minutes}m`
}

export function LogSheet({ now, onSubmit }: LogSheetProps) {
  const [timeMode, setTimeMode] = useState<TimeMode>('now')
  const [pickedLocal, setPickedLocal] = useState(() => toDatetimeLocalValue(now.toISOString()))
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [customDurationOpen, setCustomDurationOpen] = useState(false)
  const [customDurationInput, setCustomDurationInput] = useState('')
  const [note, setNote] = useState('')
  const [timeError, setTimeError] = useState<string | undefined>()
  const [durationError, setDurationError] = useState<string | undefined>()

  function selectDurationChip(minutes: DurationChip) {
    setCustomDurationOpen(false)
    setDurationError(undefined)
    // re-tapping the active chip clears it — duration is optional, and this
    // is the only way back to "empty" once a chip has been picked.
    setDurationMinutes((current) => (current === minutes ? null : minutes))
  }

  function openCustomDuration() {
    setCustomDurationOpen(true)
    setDurationError(undefined)
    setCustomDurationInput(durationMinutes !== null ? String(durationMinutes) : '')
  }

  function handleCustomDurationChange(value: string) {
    setCustomDurationInput(value)
    if (value.trim() === '') {
      setDurationMinutes(null)
      return
    }
    const parsed = Number(value)
    setDurationMinutes(Number.isFinite(parsed) ? parsed : null)
  }

  function resolveOccurredAt(): { occurredAt: string | undefined; error?: string } {
    switch (timeMode) {
      case 'now':
        return { occurredAt: undefined }
      case '1h':
        return { occurredAt: new Date(now.getTime() - HOUR_MS).toISOString() }
      case 'yesterday':
        return { occurredAt: new Date(now.getTime() - DAY_MS).toISOString() }
      case 'pick': {
        const iso = fromDatetimeLocalValue(pickedLocal)
        return iso ? { occurredAt: iso } : { occurredAt: undefined, error: 'enter a valid time' }
      }
    }
  }

  function validateDuration(): string | undefined {
    if (durationMinutes === null) return undefined
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < DURATION_MIN_MINUTES ||
      durationMinutes > DURATION_MAX_MINUTES
    ) {
      return `enter ${DURATION_MIN_MINUTES}–${DURATION_MAX_MINUTES} minutes`
    }
    return undefined
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTimeError(undefined)
    setDurationError(undefined)

    const { occurredAt, error: timeValidationError } = resolveOccurredAt()
    if (timeValidationError) {
      setTimeError(timeValidationError)
      return
    }
    const durationValidationError = validateDuration()
    if (durationValidationError) {
      setDurationError(durationValidationError)
      return
    }

    onSubmit({ occurredAt, durationMinutes, note: note.trim() === '' ? null : note.trim() })
  }

  return (
    // noValidate: the number input's min/max are UI hints, not the source of
    // truth — validateDuration() above is, and it needs to run every time so
    // its message lands in the accessible FieldError region instead of the
    // browser's own (inconsistently styled, non-lowercase) validation popup.
    <form className="log-sheet" onSubmit={handleSubmit} noValidate>
      <div className="log-sheet__field">
        <span className="log-sheet__label" id="log-sheet-time-label">
          time
        </span>
        <div className="log-sheet__chips" role="group" aria-labelledby="log-sheet-time-label">
          <button
            type="button"
            className={chipClass(timeMode === 'now')}
            aria-pressed={timeMode === 'now'}
            onClick={() => setTimeMode('now')}
          >
            now
          </button>
          <button
            type="button"
            className={chipClass(timeMode === '1h')}
            aria-pressed={timeMode === '1h'}
            onClick={() => setTimeMode('1h')}
          >
            1h ago
          </button>
          <button
            type="button"
            className={chipClass(timeMode === 'yesterday')}
            aria-pressed={timeMode === 'yesterday'}
            onClick={() => setTimeMode('yesterday')}
          >
            yesterday
          </button>
          <button
            type="button"
            className={chipClass(timeMode === 'pick')}
            aria-pressed={timeMode === 'pick'}
            onClick={() => setTimeMode('pick')}
          >
            pick…
          </button>
        </div>
        {timeMode === 'pick' && (
          <input
            type="datetime-local"
            className="log-sheet__input"
            aria-label="pick a time"
            value={pickedLocal}
            onChange={(event) => setPickedLocal(event.target.value)}
            aria-describedby="log-sheet-time-error"
          />
        )}
        <FieldError id="log-sheet-time-error" message={timeError} />
      </div>

      <div className="log-sheet__field">
        <span className="log-sheet__label" id="log-sheet-duration-label">
          duration
        </span>
        <div className="log-sheet__chips" role="group" aria-labelledby="log-sheet-duration-label">
          {DURATION_CHIPS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={chipClass(!customDurationOpen && durationMinutes === minutes)}
              aria-pressed={!customDurationOpen && durationMinutes === minutes}
              onClick={() => selectDurationChip(minutes)}
            >
              {durationChipLabel(minutes)}
            </button>
          ))}
          <button
            type="button"
            className={chipClass(customDurationOpen)}
            aria-pressed={customDurationOpen}
            onClick={openCustomDuration}
          >
            custom
          </button>
        </div>
        {customDurationOpen && (
          <input
            type="number"
            inputMode="numeric"
            min={DURATION_MIN_MINUTES}
            max={DURATION_MAX_MINUTES}
            className="log-sheet__input log-sheet__input--amount"
            aria-label="custom duration in minutes"
            value={customDurationInput}
            onChange={(event) => handleCustomDurationChange(event.target.value)}
            aria-describedby="log-sheet-duration-error"
          />
        )}
        <FieldError id="log-sheet-duration-error" message={durationError} />
      </div>

      <div className="log-sheet__field">
        <label htmlFor="log-sheet-note" className="log-sheet__label">
          note
        </label>
        <textarea
          id="log-sheet-note"
          className="log-sheet__textarea"
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <button type="submit" className="log-sheet__submit">
        log
      </button>
    </form>
  )
}
