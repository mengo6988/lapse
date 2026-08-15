/**
 * Focus trap for the Tracker sheet (this is the app's only form-heavy
 * screen, so a11y is non-negotiable here): focus moves into the sheet when
 * it opens, Tab/Shift+Tab wrap at the edges instead of escaping to the page
 * behind it, Escape closes, and focus returns to whatever opened the sheet
 * on close. `restoreFocusTo` is supplied by the caller (captured at the
 * moment the sheet was opened, e.g. trackerSheetStore) rather than read
 * here via `document.activeElement` — by the time this hook's effect runs,
 * the sheet's own content (e.g. the name field's autoFocus) may already
 * have taken focus, which would make a self-capture wrong.
 */
import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape: () => void,
  restoreFocusTo?: HTMLElement | null,
): RefObject<T> {
  const containerRef = useRef<T>(null)

  // held in refs so the setup effect below only depends on `active` —
  // re-running it on every render would re-focus the first element (or
  // re-read a stale restore target) on every keystroke inside the sheet.
  const onEscapeRef = useRef(onEscape)
  useEffect(() => {
    onEscapeRef.current = onEscape
  })
  const restoreRef = useRef(restoreFocusTo)
  useEffect(() => {
    restoreRef.current = restoreFocusTo
  })

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    if (!container.contains(document.activeElement)) {
      const first = focusableElements(container)[0]
      ;(first ?? container).focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab' || !container) return

      const elements = focusableElements(container)
      if (elements.length === 0) return
      const first = elements[0]!
      const last = elements[elements.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      restoreRef.current?.focus()
    }
  }, [active])

  return containerRef
}
