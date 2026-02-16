import { render, screen } from '@testing-library/react'
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
    attendance: [],
    weekDates: ['2026-02-13'],
    weekTarget: null,
    qaForm: { agentId: '', clientName: '', decision: 'Good Sale', notes: '' },
    setQaForm: vi.fn(),
    auditForm: { agentId: '', carrier: 'Aetna', clientName: '', reason: '', currentStatus: 'pending_cms' },
    setAuditForm: vi.fn(),
    incompleteQaAgentsToday: [] as Array<{ id: string; name: string }>,
    incompleteAuditAgentsToday: [] as Array<{ id: string; name: string }>,
    onSetAttendancePercent: vi.fn(),
    onSaveWeeklyTarget: vi.fn(),
    onQaSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.()),
    onAuditSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.()),
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
})
