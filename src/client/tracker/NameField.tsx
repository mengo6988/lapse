/**
 * The one required field (docs/design.md: "Name field focused on open — type
 * name, hit save, done"). The sheet mounts a single instance at a time, so a
 * static id is safe and keeps the label/error wiring simple.
 */
import { FieldError } from './FieldError'

const ERROR_ID = 'tracker-name-error'

interface NameFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
  autoFocus?: boolean
}

export function NameField({ value, onChange, error, autoFocus }: NameFieldProps) {
  return (
    <div className="tracker-form__field">
      <label htmlFor="tracker-name" className="tracker-form__label">
        name
      </label>
      <input
        id="tracker-name"
        name="name"
        type="text"
        className="tracker-form__input tracker-form__input--name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={ERROR_ID}
        aria-invalid={error ? true : undefined}
        autoFocus={autoFocus}
        required
      />
      <FieldError id={ERROR_ID} message={error} />
    </div>
  )
}
