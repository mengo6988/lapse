/**
 * A collapsed-by-default section (docs/design.md: Category/Threshold/Variants
 * are "optional, collapsed by default"). Hand-rolled rather than
 * `<details>`/`<summary>` for reliable, testable keyboard + aria-expanded
 * behavior across environments.
 */
import { useId, useState, type ReactNode } from 'react'

interface DisclosureProps {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}

export function Disclosure({ label, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className="tracker-form__disclosure">
      <button
        type="button"
        className="tracker-form__disclosure-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="tracker-form__disclosure-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {label}
      </button>
      {open && (
        <div id={contentId} className="tracker-form__disclosure-content">
          {children}
        </div>
      )}
    </div>
  )
}
