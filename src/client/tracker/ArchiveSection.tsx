/**
 * Archive action, edit mode only (docs/design.md § Create/Edit Tracker:
 * "archive action (edit mode)"). Archiving is reversible and non-destructive
 * (docs/spec.md: history stays intact), so a two-tap inline confirm is
 * enough — no browser confirm() dialog, no typed confirmation like hard
 * delete needs.
 */
import { useState } from 'react'
import { FieldError } from './FieldError'

const ERROR_ID = 'tracker-archive-error'

interface ArchiveSectionProps {
  onArchive: () => void
  archiving?: boolean
  error?: string
}

export function ArchiveSection({ onArchive, archiving, error }: ArchiveSectionProps) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <div className="tracker-form__archive">
        <button type="button" className="tracker-form__archive-trigger" onClick={() => setConfirming(true)}>
          archive
        </button>
        <FieldError id={ERROR_ID} message={error} />
      </div>
    )
  }

  return (
    <div className="tracker-form__archive tracker-form__archive--confirming">
      <p className="tracker-form__archive-copy">archive this tracker? hidden from home and list — history stays intact.</p>
      <div className="tracker-form__archive-actions">
        <button type="button" className="tracker-form__archive-cancel" onClick={() => setConfirming(false)}>
          cancel
        </button>
        <button
          type="button"
          className="tracker-form__archive-confirm"
          onClick={onArchive}
          disabled={archiving}
          aria-busy={archiving}
        >
          archive
        </button>
      </div>
      <FieldError id={ERROR_ID} message={error} />
    </div>
  )
}
