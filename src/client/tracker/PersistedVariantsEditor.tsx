/**
 * Variant management in the edit flow: add, rename, set/clear the
 * per-Variant Threshold override, soft-delete (docs/spec.md § Domain rules,
 * § Deletes). Unlike the create flow, every action here is a live request —
 * there's an existing Tracker to attach to.
 */
import { useState } from 'react'
import { FieldError } from './FieldError'
import { TrackerApiError } from './mutationClient'
import { useAddVariant } from './useAddVariant'
import { useRemoveVariant } from './useRemoveVariant'
import { useUpdateVariant } from './useUpdateVariant'
import { VariantRow } from './VariantRow'

interface PersistedVariant {
  id: string
  name: string
  thresholdDays: number | null
}

interface PersistedVariantsEditorProps {
  trackerId: string
  variants: readonly PersistedVariant[]
}

interface RowErrors {
  name?: string
  thresholdDays?: string
}

function messageFrom(error: unknown, field: 'name' | 'thresholdDays'): string | undefined {
  if (!(error instanceof TrackerApiError)) return undefined
  return error.fieldErrors[field] ?? error.message
}

export function PersistedVariantsEditor({ trackerId, variants }: PersistedVariantsEditorProps) {
  const updateVariant = useUpdateVariant()
  const addVariant = useAddVariant()
  const removeVariant = useRemoveVariant()

  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({})
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string>()

  function setRowError(variantId: string, patch: RowErrors) {
    setRowErrors((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...patch } }))
  }

  function commitName(variantId: string, name: string) {
    updateVariant.mutate(
      { variantId, name },
      {
        onSuccess: () => setRowError(variantId, { name: undefined }),
        onError: (error) => setRowError(variantId, { name: messageFrom(error, 'name') }),
      },
    )
  }

  function commitThreshold(variantId: string, thresholdDays: number | null) {
    updateVariant.mutate(
      { variantId, thresholdDays },
      {
        onSuccess: () => setRowError(variantId, { thresholdDays: undefined }),
        onError: (error) => setRowError(variantId, { thresholdDays: messageFrom(error, 'thresholdDays') }),
      },
    )
  }

  function remove(variantId: string) {
    setRemovingId(variantId)
    removeVariant.mutate({ trackerId, variantId }, { onSettled: () => setRemovingId(null) })
  }

  function addNew() {
    const trimmed = newName.trim()
    if (trimmed.length === 0) return
    addVariant.mutate(
      { trackerId, name: trimmed },
      {
        onSuccess: () => {
          setNewName('')
          setAddError(undefined)
        },
        onError: (error) => setAddError(messageFrom(error, 'name')),
      },
    )
  }

  return (
    <div className="tracker-form__variants">
      {variants.map((variant) => (
        <VariantRow
          key={variant.id}
          rowId={variant.id}
          name={variant.name}
          thresholdDays={variant.thresholdDays}
          onNameCommit={(name) => commitName(variant.id, name)}
          onThresholdChange={(days) => commitThreshold(variant.id, days)}
          onRemove={() => remove(variant.id)}
          nameError={rowErrors[variant.id]?.name}
          thresholdError={rowErrors[variant.id]?.thresholdDays}
          removing={removingId === variant.id}
        />
      ))}
      <div className="tracker-form__add-variant-row">
        <label htmlFor="new-variant-name" className="tracker-form__label">
          new variant
        </label>
        <input
          id="new-variant-name"
          className="tracker-form__input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addNew()
            }
          }}
          aria-describedby="new-variant-name-error"
        />
        <FieldError id="new-variant-name-error" message={addError} />
        <button type="button" className="tracker-form__add-variant" onClick={addNew}>
          add variant
        </button>
      </div>
    </div>
  )
}
