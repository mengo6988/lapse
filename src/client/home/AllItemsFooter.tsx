import { Link } from 'react-router-dom'

interface AllItemsFooterProps {
  readonly count: number
}

/**
 * footer row into the full ledger (docs/design.md § Home). Always the plain
 * `/list` route — the header magnifier is the only thing that opens search
 * (`/list?search=open`); this footer never carries that query param.
 */
export function AllItemsFooter({ count }: AllItemsFooterProps) {
  return (
    <Link to="/list" className="all-items">
      <span className="all-items__label">all items</span>
      <span className="all-items__count">
        {count} <span aria-hidden="true">→</span>
      </span>
    </Link>
  )
}
