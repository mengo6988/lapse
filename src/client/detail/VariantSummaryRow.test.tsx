import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ListRow } from '../domain/trackerRows'
import type { VariantInsight } from './variantInsights'
import { VariantSummaryRow } from './VariantSummaryRow'

const NOW = new Date(2026, 7, 15, 12, 0, 0)

function row(overrides: Partial<ListRow> = {}): ListRow {
  return {
    key: 'v1',
    trackerId: 't1',
    variantId: 'v1',
    name: 'tyre pressure',
    variantName: 'volvo',
    categoryId: null,
    thresholdDays: 20,
    lastEntryAt: new Date(2026, 7, 10).toISOString(),
    urgency: 'fresh',
    ...overrides,
  }
}

function insight(overrides: Partial<VariantInsight> = {}): VariantInsight {
  return { rowKey: 'v1', observedIntervalDays: null, suggestion: null, ...overrides }
}

describe('VariantSummaryRow', () => {
  it('shows the Variant name and its last-done subline via the shared list formatter', () => {
    render(<VariantSummaryRow row={row()} insight={insight()} now={NOW} onAcceptSuggestion={vi.fn()} />)
    expect(screen.getByText('volvo')).toBeTruthy()
    expect(screen.getByText(/last done/)).toBeTruthy()
  })

  it('falls back to the Tracker name for a tracker-level (no-Variant) row', () => {
    render(<VariantSummaryRow row={row({ variantId: null, variantName: null })} insight={insight()} now={NOW} onAcceptSuggestion={vi.fn()} />)
    expect(screen.getByText('tyre pressure')).toBeTruthy()
  })

  it('shows the observed-interval line once it is defined', () => {
    render(<VariantSummaryRow row={row()} insight={insight({ observedIntervalDays: 12.4 })} now={NOW} onAcceptSuggestion={vi.fn()} />)
    expect(screen.getByText('actually every ~12d')).toBeTruthy()
  })

  it('omits the observed-interval line entirely below 3 Entries', () => {
    render(<VariantSummaryRow row={row()} insight={insight()} now={NOW} onAcceptSuggestion={vi.fn()} />)
    expect(screen.queryByText(/actually every/)).toBeNull()
  })

  it('shows the "update threshold?" hint with one-tap accept', async () => {
    const onAccept = vi.fn()
    render(
      <VariantSummaryRow
        row={row({ thresholdDays: 20 })}
        insight={insight({ observedIntervalDays: 30, suggestion: { kind: 'update', observedIntervalDays: 30 } })}
        now={NOW}
        onAcceptSuggestion={onAccept}
      />,
    )
    expect(screen.getByText(/update threshold\?/)).toBeTruthy()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'accept' }))
    expect(onAccept).toHaveBeenCalledWith(row({ thresholdDays: 20 }), 30)
  })

  it('shows the gentler "set threshold?" hint for a thresholdless row', () => {
    render(
      <VariantSummaryRow
        row={row({ thresholdDays: null })}
        insight={insight({ observedIntervalDays: 18, suggestion: { kind: 'set', observedIntervalDays: 18 } })}
        now={NOW}
        onAcceptSuggestion={vi.fn()}
      />,
    )
    expect(screen.getByText(/set threshold\?/)).toBeTruthy()
  })

  it('disables the accept button while a mutation is in flight', () => {
    render(
      <VariantSummaryRow
        row={row()}
        insight={insight({ observedIntervalDays: 30, suggestion: { kind: 'update', observedIntervalDays: 30 } })}
        now={NOW}
        onAcceptSuggestion={vi.fn()}
        accepting
      />,
    )
    expect(screen.getByRole('button', { name: 'accept' })).toHaveProperty('disabled', true)
  })
})
