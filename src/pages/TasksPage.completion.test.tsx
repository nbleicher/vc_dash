import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TasksPage } from './TasksPage'

function baseProps() {
  return {
    taskPage: 'qa' as const,
    setTaskPage: vi.fn(),
    activeAgents: [
      { id: 'a1', name: 'Alex', active: true, createdAt: new Date().toISOString() },
      { id: 'a2', name: 'Jordan', active: true, createdAt: new Date().toISOString() },
    ],
    auditRecords: [],
    spiffRecords: [],
    currentWeekKey: '2026-02-09',
    selectedAttendanceWeekKey: '2026-02-09',
    setSelectedAttendanceWeekKey: vi.fn(),
    attendanceWeekDates: ['2026-02-13'],
    attendanceWeekOptions: [{ weekKey: '2026-02-09', label: '2/9-2/13' }],
    weekTarget: null,
    qaForm: { agentId: '', clientName: '', decision: 'Good Sale', callId: '', notes: '' },
    setQaForm: vi.fn(),
    auditForm: { agentId: '' },
    setAuditForm: vi.fn(),
    incompleteQaAgentsToday: [] as Array<{ id: string; name: string }>,
    incompleteAuditAgentsToday: [] as Array<{ id: string; name: string }>,
    lastPoliciesBotRun: null as string | null,
    onSetSpiffAmount: vi.fn(),
    onSaveWeeklyTarget: vi.fn(),
    onQaSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.()),
    onAuditNoActionSubmit: vi.fn(),
    onUpdateAuditRecord: vi.fn(),
    onDeleteAuditRecord: vi.fn(),
    weekTrend: { totalSales: 0, currentCpa: null as number | null },
    house6pmSnapshotForToday: null as { dateKey: string; houseSales: number; houseCpa: number | null; capturedAt: string } | null,
    eodReports: [],
    onSaveEodReport: vi.fn(),
    agentPerformanceRows: [] as Array<{ agentId: string; agentName: string; calls: number; sales: number; marketing: number; cpa: number | null; cvr: number | null }>,
    lastSnapshotLabel: 'N/A',
  }
}

describe('TasksPage completion boxes', () => {
  it('shows QA missing-agent list when incomplete', () => {
    render(
      <TasksPage
        {...baseProps()}
        taskPage="qa"
        incompleteQaAgentsToday={[
          { id: 'a1', name: 'Alex' },
          { id: 'a2', name: 'Jordan' },
        ]}
      />,
    )
    expect(screen.getByText('Daily QA Completion')).toBeInTheDocument()
    expect(screen.getAllByText(/Missing \(2\):/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alex', { selector: 'strong' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jordan', { selector: 'strong' }).length).toBeGreaterThan(0)
  })

  it('shows QA success message when all completed', () => {
    render(<TasksPage {...baseProps()} taskPage="qa" incompleteQaAgentsToday={[]} />)
    expect(screen.getByText('All active agents have Daily QA completed for today.')).toBeInTheDocument()
  })

  it('shows Audit missing-agent list when incomplete', () => {
    render(
      <TasksPage
        {...baseProps()}
        taskPage="audit"
        incompleteAuditAgentsToday={[
          { id: 'a1', name: 'Alex' },
          { id: 'a2', name: 'Jordan' },
        ]}
      />,
    )
    expect(screen.getByText('Action Needed Audit Completion')).toBeInTheDocument()
    expect(screen.getAllByText(/Missing \(2\):/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alex', { selector: 'strong' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jordan', { selector: 'strong' }).length).toBeGreaterThan(0)
  })

  it('shows Audit success message when all completed', () => {
    render(<TasksPage {...baseProps()} taskPage="audit" incompleteAuditAgentsToday={[]} />)
    expect(screen.getByText('All active agents have Action Needed Audit completed for today.')).toBeInTheDocument()
  })

  it('allows marking no action needed from audit task', () => {
    const props = baseProps()
    render(<TasksPage {...props} taskPage="audit" auditForm={{ agentId: 'a1' }} />)
    const auditSection = screen.getAllByText('Action Needed Audit').at(-1)?.closest('section')
    expect(auditSection).not.toBeNull()
    within(auditSection!).getByRole('button', { name: 'Submit No Action Needed' }).click()
    expect(props.onAuditNoActionSubmit).toHaveBeenCalled()
  })
})
