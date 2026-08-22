/**
 * The create/edit Tracker form (docs/design.md § Create/Edit Tracker):
 * name-first, everything else collapsed and optional. Create posts once on
 * submit; edit's Save only touches the tracker-level fields (name/Category/
 * Threshold) — Variant add/rename/threshold/remove already happened live,
 * via PersistedVariantsEditor, by the time Save is pressed.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category, Tracker } from '../api'
import { ArchiveSection } from './ArchiveSection'
import { CategoryPicker } from './CategoryPicker'
import { Disclosure } from './Disclosure'
import { NameField } from './NameField'
import { TrackerApiError } from './mutationClient'
import { buildVariantsPayload, remapVariantFieldErrors } from './pendingVariantsPayload'
import { PendingVariantsEditor, type PendingVariant } from './PendingVariantsEditor'
import { PersistedVariantsEditor } from './PersistedVariantsEditor'
import { ThresholdPicker } from './ThresholdPicker'
import { useCreateTracker } from './useCreateTracker'
import { useUpdateTracker } from './useUpdateTracker'

export type TrackerFormProps =
  | { mode: 'create'; categories: readonly Category[]; onClose: () => void }
  | { mode: 'edit'; tracker: Tracker; categories: readonly Category[]; onClose: () => void }

export function TrackerForm(props: TrackerFormProps) {
  const { categories, onClose } = props
  const tracker = props.mode === 'edit' ? props.tracker : undefined

  const [name, setName] = useState(tracker?.name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(tracker?.categoryId ?? null)
  const [thresholdDays, setThresholdDays] = useState<number | null>(tracker?.thresholdDays ?? null)
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | undefined>()
  const [archiveError, setArchiveError] = useState<string | undefined>()

  const navigate = useNavigate()
  const createTracker = useCreateTracker()
  const updateTracker = useUpdateTracker()
  const saving = props.mode === 'create' ? createTracker.isPending : updateTracker.isPending

  function applySaveError(error: unknown) {
    if (!(error instanceof TrackerApiError)) return
    setFieldErrors(error.fieldErrors)
    setFormError(Object.keys(error.fieldErrors).length === 0 ? error.message : undefined)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError(undefined)

    if (props.mode === 'create') {
      const { payload: variants, originalIndexByPayloadIndex } = buildVariantsPayload(pendingVariants)
      createTracker.mutate(
        { name: name.trim(), categoryId, thresholdDays, variants },
        {
          /*
           * Land on the List, not wherever the sheet was opened from. A
           * brand-new Tracker is invisible on Home: the slipping section
           * takes only due-soon/overdue rows (selectSlippingRows.ts) and a
           * never-logged row can't be either, while the quick-log grid is
           * six tiles ranked by recency (selectQuickLogRows.ts), which a
           * never-logged row sorts to the back of. So the moment the user is
           * most likely to want to log the thing they just named is the
           * moment the app has nowhere to show it — closing the sheet looks
           * like nothing happened. The List always has the row, and a
           * thresholded one sorts to the very top.
           */
          onSuccess: () => {
            onClose()
            navigate('/list')
          },
          onError: (error) => {
            if (!(error instanceof TrackerApiError)) return
            applySaveError(new TrackerApiError(error.status, error.message, remapVariantFieldErrors(error.fieldErrors, originalIndexByPayloadIndex)))
          },
        },
      )
      return
    }

    updateTracker.mutate(
      { id: props.tracker.id, name: name.trim(), categoryId, thresholdDays },
      { onSuccess: onClose, onError: applySaveError },
    )
  }

  function handleArchive() {
    if (props.mode !== 'edit') return
    setArchiveError(undefined)
    updateTracker.mutate(
      { id: props.tracker.id, archived: true },
      { onSuccess: onClose, onError: (error) => setArchiveError(error instanceof TrackerApiError ? error.message : undefined) },
    )
  }

  return (
    <form className="tracker-form" onSubmit={handleSubmit}>
      <NameField value={name} onChange={setName} error={fieldErrors.name} autoFocus={props.mode === 'create'} />

      <Disclosure label="category">
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} error={fieldErrors.categoryId} />
      </Disclosure>

      <Disclosure label="threshold">
        <ThresholdPicker id="tracker-threshold" value={thresholdDays} onChange={setThresholdDays} error={fieldErrors.thresholdDays} />
      </Disclosure>

      <Disclosure label="variants">
        {props.mode === 'create' ? (
          <PendingVariantsEditor value={pendingVariants} onChange={setPendingVariants} fieldErrors={fieldErrors} />
        ) : (
          <PersistedVariantsEditor trackerId={props.tracker.id} variants={props.tracker.variants} />
        )}
      </Disclosure>

      {formError && (
        <p className="tracker-form__error" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" className="tracker-form__submit" disabled={saving} aria-busy={saving}>
        {props.mode === 'create' ? 'add tracker' : 'save'}
      </button>

      {props.mode === 'edit' && (
        <ArchiveSection onArchive={handleArchive} archiving={updateTracker.isPending} error={archiveError} />
      )}
    </form>
  )
}
