/**
 * One Variant row, used both for a pending (unsaved, create-flow) row and a
 * persisted (edit-flow) row — this component doesn't know which. The name
 * field commits on blur/Enter rather than per keystroke (a rename is one
 * PATCH in edit mode, not one per character); the Threshold picker and
 * remove button act immediately, since a chip click or a delete is already
 * a single discrete action.
 */
import { useEffect, useState } from 'react'
import { FieldError } from './FieldError'
import { ThresholdPicker } from './ThresholdPicker'

interface VariantRowProps {
  /** stable across re-renders — an existing Variant's id, or a local draft id. */
  rowId: string
  name: string
  thresholdDays: number | null
  onNameCommit: (name: string) => void
  onThresholdChange: (days: number | null) => void
  onRemove: () => void
  nameError?: string
  thresholdError?: string
  removing?: boolean
}

export function VariantRow({
  rowId,
  name,
  thresholdDays,
  onNameCommit,
  onThresholdChange,
  onRemove,
  nameError,
  thresholdError,
  removing,
}: VariantRowProps) {
  const [draftName, setDraftName] = useState(name)
  // resync if the persisted name changes from outside (e.g. a server echo).
  useEffect(() => setDraftName(name), [name])

  function commit() {
    const trimmed = draftName.trim()
    if (trimmed.length > 0 && trimmed !== name) onNameCommit(trimmed)
  }

  const nameId = `variant-${rowId}-name`
  const nameErrorId = `${nameId}-error`

  return (
    <div className="tracker-form__variant-row">
      <div className="tracker-form__field">
        <label htmlFor={nameId} className="tracker-form__label">
          variant name
        </label>
        <input
          id={nameId}
          className="tracker-form__input"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
          aria-describedby={nameErrorId}
        />
        <FieldError id={nameErrorId} message={nameError} />
      </div>
      <ThresholdPicker
        id={`variant-${rowId}-threshold`}
        value={thresholdDays}
        onChange={onThresholdChange}
        noneLabel="inherit parent"
        error={thresholdError}
      />
      <button
        type="button"
        className="tracker-form__remove-variant"
        onClick={onRemove}
        disabled={removing}
        aria-label={`remove ${name.length > 0 ? name : 'variant'}`}
      >
        remove
      </button>
    </div>
  )
}
