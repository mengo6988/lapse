/**
 * Threshold preset chips + custom (docs/design.md § Create/Edit Tracker).
 * Reused at Tracker level ("no threshold" as the default/clearing state) and
 * per-Variant row ("inherit parent" instead — docs/spec.md § Domain rules:
 * a null Variant thresholdDays inherits the parent's).
 */
import { useState } from 'react'
import { daysFromCustomInput, presetMatching, THRESHOLD_PRESETS, THRESHOLD_UNITS, type ThresholdUnit } from './thresholdPresets'
import { FieldError } from './FieldError'

interface ThresholdPickerProps {
  /** unique id prefix — this component can appear many times (one per Variant row). */
  id: string
  value: number | null
  onChange: (days: number | null) => void
  noneLabel?: string
  error?: string
}

function chipClass(active: boolean): string {
  return active ? 'tracker-form__chip tracker-form__chip--active' : 'tracker-form__chip'
}

export function ThresholdPicker({ id, value, onChange, noneLabel = 'no threshold', error }: ThresholdPickerProps) {
  const initialPreset = presetMatching(value)
  const [customOpen, setCustomOpen] = useState(value !== null && !initialPreset)
  const [customAmount, setCustomAmount] = useState(customOpen ? String(value) : '')
  const [customUnit, setCustomUnit] = useState<ThresholdUnit>('day')

  const matchedPreset = presetMatching(value)
  const errorId = `${id}-error`
  const amountId = `${id}-amount`
  const unitId = `${id}-unit`

  function selectPreset(days: number) {
    setCustomOpen(false)
    onChange(days)
  }

  function selectNone() {
    setCustomOpen(false)
    onChange(null)
  }

  function openCustom() {
    setCustomOpen(true)
  }

  function applyCustom(amount: string, unit: ThresholdUnit) {
    const days = daysFromCustomInput(Number(amount), unit)
    if (days !== null) onChange(days)
  }

  return (
    <div className="tracker-form__field">
      <div className="tracker-form__chips" role="group" aria-label="threshold" aria-describedby={errorId}>
        <button type="button" className={chipClass(value === null && !customOpen)} aria-pressed={value === null && !customOpen} onClick={selectNone}>
          {noneLabel}
        </button>
        {THRESHOLD_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={chipClass(!customOpen && matchedPreset?.label === preset.label)}
            aria-pressed={!customOpen && matchedPreset?.label === preset.label}
            onClick={() => selectPreset(preset.days)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" className={chipClass(customOpen)} aria-pressed={customOpen} onClick={openCustom}>
          custom
        </button>
      </div>
      {customOpen && (
        <div className="tracker-form__custom-threshold">
          <label htmlFor={amountId} className="tracker-form__label">
            amount
          </label>
          <input
            id={amountId}
            type="number"
            inputMode="numeric"
            min={1}
            className="tracker-form__input tracker-form__input--amount"
            value={customAmount}
            onChange={(event) => {
              setCustomAmount(event.target.value)
              applyCustom(event.target.value, customUnit)
            }}
          />
          <label htmlFor={unitId} className="tracker-form__label">
            unit
          </label>
          <select
            id={unitId}
            className="tracker-form__select"
            value={customUnit}
            onChange={(event) => {
              const unit = event.target.value as ThresholdUnit
              setCustomUnit(unit)
              applyCustom(customAmount, unit)
            }}
          >
            {THRESHOLD_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
