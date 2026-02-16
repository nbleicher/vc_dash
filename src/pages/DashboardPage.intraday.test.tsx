import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

function baseProps() {
  return {
    agents: [{ id: 'a1', name: 'Alex', active: true, createdAt: '2026-02-15T12:00:00.000Z' }],
    activeAgents: [{ id: 'a1', name: 'Alex', active: true, createdAt: '2026-02-15T12:00:00.000Z' }],
    todayKey: '2026-02-15',
    now: new Date('2026-02-15T16:00:00.000Z'),
    houseLive: { totalCalls: 0, totalSales: 0, marketing: 0, cpa: null, cvr: null },
    floorCapacity: 0,
    weekTarget: null,
    weekTrend: { totalSales: 0, currentCpa: null, salesProgress: null, cpaTarget: null, cpaDelta: null },
    actionQa: [],
    actionAudit: [],
    attendanceAlert: false,
    intraAlert: false,
    overdueSlots: [],
    snapshots: [],
    intraSubmissions: [],
    onResolveQa: vi.fn(),
    onToggleAuditFlag: vi.fn(),
    onGoToAttendance: vi.fn(),
    onUpsertSnapshot: vi.fn(),
    onSubmitIntraSlot: vi.fn(),
  }
}

describe('DashboardPage intra-day entry', () => {
  it('renders per-hour submit cards with agent dropdowns', () => {
    render(<DashboardPage {...baseProps()} />)
    expect(screen.getAllByRole('button', { name: 'Submit Hour' })).toHaveLength(4)
    expect(screen.getAllByRole('combobox')).toHaveLength(4)
  })

  it('shows submitted badge for submitted slot', () => {
    render(
      <DashboardPage
        {...baseProps()}
        intraSubmissions={[
          {
            id: 'intra_sub_1',
            dateKey: '2026-02-15',
            slot: '11:00',
            submittedAt: '2026-02-15T15:58:00.000Z',
            updatedAt: '2026-02-15T15:58:00.000Z',
            submittedBy: 'manual',
            slotSignature: '',
          },
        ]}
      />,
    )
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })
})
