/**
 * Variant rows in the create flow (docs/design.md: "Variants (add rows)" is
 * one of the collapsed, optional sections). Nothing here talks to the
 * server — rows are drafts held in TrackerForm's state and sent inline with
 * the POST /trackers body (docs/spec.md § API: `variants?` on create).
 */
import { VariantRow } from './VariantRow'

export interface PendingVariant {
  localId: string
  name: string
  thresholdDays: number | null
}

let draftCounter = 0
function nextLocalId(): string {
  draftCounter += 1
  return `draft-${draftCounter}`
}

interface PendingVariantsEditorProps {
  value: PendingVariant[]
  onChange: (next: PendingVariant[]) => void
  fieldErrors: Record<string, string>
}

export function PendingVariantsEditor({ value, onChange, fieldErrors }: PendingVariantsEditorProps) {
  function addRow() {
    onChange([...value, { localId: nextLocalId(), name: '', thresholdDays: null }])
  }

  function updateRow(rowId: string, patch: Partial<PendingVariant>) {
    onChange(value.map((row) => (row.localId === rowId ? { ...row, ...patch } : row)))
  }

  function removeRow(rowId: string) {
    onChange(value.filter((row) => row.localId !== rowId))
  }

  return (
    <div className="tracker-form__variants">
      {value.map((row, index) => (
        <VariantRow
          key={row.localId}
          rowId={row.localId}
          name={row.name}
          thresholdDays={row.thresholdDays}
          onNameCommit={(name) => updateRow(row.localId, { name })}
          onThresholdChange={(thresholdDays) => updateRow(row.localId, { thresholdDays })}
          onRemove={() => removeRow(row.localId)}
          nameError={fieldErrors[`variants.${index}.name`]}
          thresholdError={fieldErrors[`variants.${index}.thresholdDays`]}
        />
      ))}
      <button type="button" className="tracker-form__add-variant" onClick={addRow}>
        add variant
      </button>
    </div>
  )
}
