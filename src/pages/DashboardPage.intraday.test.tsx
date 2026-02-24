import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

function baseProps() {
  return {
    agents: [{ id: 'a1', name: 'Alex', active: true, createdAt: '2026-02-15T12:00:00.000Z' }],
    now: new Date('2026-02-15T16:00:00.000Z'),
    houseLive: { totalCalls: 0, totalSales: 0, marketing: 0, cpa: null, cvr: null },
    agentPerformanceRows: [
      {
        agentId: 'a1',
        agentName: 'Alex',
        calls: 10,
        sales: 2,
        marketing: 150,
        cpa: 75,
        cvr: 0.2,
      },
    ],
    floorCapacity: 0,
    weekTarget: null,
    weekTrend: { totalSales: 0, currentCpa: null, salesProgress: null, cpaTarget: null, cpaDelta: null },
    actionQa: [],
    actionAudit: [],
    attendanceAlert: false,
    intraAlert: false,
    overdueSlots: [],
    onResolveQa: vi.fn(),
    onToggleAuditFlag: vi.fn(),
    onGoToAttendance: vi.fn(),
  }
}

describe('DashboardPage agent performance', () => {
  it('renders Agent Performance table with all agents', () => {
    render(<DashboardPage {...baseProps()} />)
    expect(screen.getByRole('heading', { name: 'Agent Performance' })).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows no active agents message when agentPerformanceRows is empty', () => {
    render(<DashboardPage {...baseProps()} agentPerformanceRows={[]} />)
    expect(screen.getByText('No active agents.')).toBeInTheDocument()
  })

  it('highlights row when CPA is over 130', () => {
    const props = baseProps()
    props.agentPerformanceRows = [
      { ...props.agentPerformanceRows[0], cpa: 150, agentName: 'High CPA Agent' },
    ]
    const { container } = render(<DashboardPage {...props} />)
    const row = container.querySelector('tbody tr')
    expect(row).toHaveClass('bg-red-500/10')
    expect(screen.getByText('High CPA Agent')).toBeInTheDocument()
  })
})
