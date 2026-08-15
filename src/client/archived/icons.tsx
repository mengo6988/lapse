/**
 * Back-affordance icon for this screen (docs/design.md § Navigation: a
 * standalone iOS PWA has no OS back gesture, so every depth-2 screen needs
 * its own explicit back control). Local to this directory rather than added
 * to src/client/shell/icons.tsx, which build ticket 16's file fence keeps
 * off-limits — matches that file's 1.4-stroke/currentColor convention.
 */
type IconProps = React.SVGProps<SVGSVGElement>

export function BackIcon(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" {...props}>
      <polyline points="15 5 8 12 15 19" />
    </svg>
  )
}
