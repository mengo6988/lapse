/**
 * inline icon set matching docs/design.md — 1.4 stroke, 22px nav / 20px
 * header. currentColor throughout so the parent button controls state.
 */

type IconProps = React.SVGProps<SVGSVGElement>

export function HomeIcon(props: IconProps) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />
    </svg>
  )
}

export function ListIcon(props: IconProps) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <line x1="5" y1="7" x2="19" y2="7" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="17" x2="19" y2="17" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" {...props}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  )
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <line x1="3" y1="8" x2="21" y2="8" />
      <circle cx="15" cy="8" r="2.6" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <circle cx="9" cy="16" r="2.6" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  )
}
