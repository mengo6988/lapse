/**
 * The one place a per-field server error renders. Always mounted (even with
 * no message) so `aria-live="polite"` announces a message that appears
 * later without needing the region itself to be inserted into the DOM —
 * a live region only announces changes to content already present.
 */
interface FieldErrorProps {
  id: string
  message?: string
}

export function FieldError({ id, message }: FieldErrorProps) {
  return (
    <p id={id} className="tracker-form__field-error" aria-live="polite">
      {message ?? ''}
    </p>
  )
}
