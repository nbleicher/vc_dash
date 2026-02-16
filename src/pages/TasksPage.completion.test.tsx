import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TasksPage } from './TasksPage'

function baseProps() {
  return {
    taskPage: 'qa' as const,
    setTaskPage: vi.fn(),
    todayKey: '2026-02-15',
    activeAgents: [
      { id: 'a1', name: 'Alex', active: true, createdAt: new Date().toISOString() },
      { id: 'a2', name: 'Jordan', active: true, createdAt: new Date().toISOString() },
    ],
    attendance: [],
    attendanceSubmissions: [],
    weekDates: ['2026-02-13'],
    weekTarget: null,
    qaForm: { agentId: '', clientName: '', decision: 'Good Sale', notes: '' },
    setQaForm: vi.fn(),
    auditForm: { agentId: '', carrier: 'Aetna', clientName: '', reason: '', currentStatus: 'pending_cms' },
    setAuditForm: vi.fn(),
    incompleteQaAgentsToday: [] as Array<{ id: string; name: string }>,
    incompleteAuditAgentsToday: [] as Array<{ id: string; name: string }>,
    onSetAttendancePercent: vi.fn(),
    onSubmitAttendanceDay: vi.fn(),
    onSaveWeeklyTarget: vi.fn(),
    onQaSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.()),
    onAuditSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.()),
    onAuditNoActionSubmit: vi.fn(),
  }
}

describe('TasksPage completion boxes', () => {
  it('renders per-day attendance submit controls', () => {
    render(
      <TasksPage
        {...baseProps()}
        taskPage="attendance"
        weekDates={['2026-02-13', '2026-02-14', '2026-02-15']}
      />,
    )
    expect(screen.getAllByRole('button', { name: 'Submit Day' })).toHaveLength(1)
    expect(screen.getAllByText('Not submitted').length).toBeGreaterThan(0)
  })

  it('shows submitted status for submitted attendance day', () => {
    render(
      <TasksPage
        {...baseProps()}
        taskPage="attendance"
        weekDates={['2026-02-15']}
        attendanceSubmissions={[
          {
            id: 'att_sub_1',
            dateKey: '2026-02-15',
            submittedAt: '2026-02-15T15:58:00.000Z',
            updatedAt: '2026-02-15T15:58:00.000Z',
            submittedBy: 'manual',
            daySignature: 'a1:100|a2:100',
          },
        ]}
      />,
    )
    expect(screen.getByText(/Submitted:/)).toBeInTheDocument()
  })

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
    render(<TasksPage {...props} taskPage="audit" />)
    const auditSection = screen.getAllByText('Action Needed Audit').at(-1)?.closest('section')
    expect(auditSection).not.toBeNull()
    within(auditSection!).getByRole('button', { name: 'Mark No Action Needed' }).click()
    expect(props.onAuditNoActionSubmit).toHaveBeenCalled()
  })
})
