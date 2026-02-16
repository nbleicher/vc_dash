import { WeeklyTargetEditor } from '../components'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Tabs, Textarea } from '../components'
import { CARRIERS, POLICY_STATUSES } from '../constants'
import type { AttendanceRecord } from '../types'
import type { AttendancePercent } from '../types'
import type { DataStore } from '../data'

type Props = {
  taskPage: 'attendance' | 'qa' | 'audit' | 'targets'
  setTaskPage: (p: 'attendance' | 'qa' | 'audit' | 'targets') => void
  todayKey: string
  activeAgents: DataStore['agents']
  attendance: AttendanceRecord[]
  attendanceSubmissions: DataStore['attendanceSubmissions']
  weekDates: string[]
  weekTarget: { weekKey: string; targetSales: number; targetCpa: number; setAt: string } | null
  qaForm: { agentId: string; clientName: string; decision: string; notes: string }
  setQaForm: React.Dispatch<
    React.SetStateAction<{ agentId: string; clientName: string; decision: string; notes: string }>
  >
  auditForm: {
    agentId: string
    carrier: string
    clientName: string
    reason: string
    currentStatus: string
  }
  setAuditForm: React.Dispatch<
    React.SetStateAction<{
      agentId: string
      carrier: string
      clientName: string
      reason: string
      currentStatus: string
    }>
  >
  incompleteQaAgentsToday: Array<{ id: string; name: string }>
  incompleteAuditAgentsToday: Array<{ id: string; name: string }>
  onSetAttendancePercent: (agentId: string, dateKey: string, percent: AttendancePercent) => void
  onSubmitAttendanceDay: (dateKey: string) => void
  onSaveWeeklyTarget: (sales: number, cpa: number) => void
  onQaSubmit: (e: React.FormEvent) => void
  onAuditSubmit: (e: React.FormEvent) => void
  onAuditNoActionSubmit: () => void
}

export function TasksPage({
  taskPage,
  setTaskPage,
  todayKey,
  activeAgents,
  attendance,
  attendanceSubmissions,
  weekDates,
  weekTarget,
  qaForm,
  setQaForm,
  auditForm,
  setAuditForm,
  incompleteQaAgentsToday,
  incompleteAuditAgentsToday,
  onSetAttendancePercent,
  onSubmitAttendanceDay,
  onSaveWeeklyTarget,
  onQaSubmit,
  onAuditSubmit,
  onAuditNoActionSubmit,
}: Props) {
  const renderMissingNames = (rows: Array<{ id: string; name: string }>) =>
    rows.map((agent, idx) => (
      <span key={agent.id}>
        <strong>{agent.name}</strong>
        {idx < rows.length - 1 ? ', ' : ''}
      </span>
    ))

  const taskItems = [
    { key: 'attendance' as const, label: 'Attendance' },
    { key: 'qa' as const, label: 'Daily QA' },
    { key: 'audit' as const, label: 'Action Needed Audit' },
    { key: 'targets' as const, label: 'Weekly Targets' },
  ]

  return (
    <div className="page-grid">
      <Card className="control-bar">
        <Tabs value={taskPage} onChange={setTaskPage} items={taskItems} />
      </Card>

      {taskPage === 'attendance' && (
        <Card className="space-y-4">
          <CardTitle>Attendance (Mon-Fri)</CardTitle>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Agent</th>
                  {weekDates.map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeAgents.length === 0 && (
                  <tr>
                    <td colSpan={6}>N/A - no active agents.</td>
                  </tr>
                )}
                {activeAgents.map((agent) => (
                  <tr key={agent.id}>
                    <td>{agent.name}</td>
                    {weekDates.map((d) => {
                      const row = attendance.find((a) => a.agentId === agent.id && a.dateKey === d)
                      return (
                        <td key={d}>
                          <Select
                            value={row?.percent ?? 100}
                            onChange={(e) =>
                              onSetAttendancePercent(agent.id, d, Number(e.target.value) as AttendancePercent)
                            }
                          >
                            <option value={100}>100%</option>
                            <option value={75}>75%</option>
                            <option value={50}>50%</option>
                            <option value={25}>25%</option>
                            <option value={0}>0%</option>
                          </Select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Today ({todayKey})</p>
            <Button type="button" variant="default" className="mt-2 w-full sm:w-auto" onClick={() => onSubmitAttendanceDay(todayKey)}>
              Submit Day
            </Button>
            <p className="mt-2 text-xs text-slate-500">
              {(() => {
                const submission = attendanceSubmissions.find((item) => item.dateKey === todayKey)
                return submission ? `Submitted: ${new Date(submission.submittedAt).toLocaleString()}` : 'Not submitted'
              })()}
            </p>
          </div>
        </Card>
      )}

      {taskPage === 'qa' && (
        <Card className="space-y-4">
          <CardTitle>Daily QA Log</CardTitle>
          <div className="control-bar">
            <strong>Daily QA Completion</strong>
            {incompleteQaAgentsToday.length > 0 ? (
              <p>
                Missing ({incompleteQaAgentsToday.length}): {renderMissingNames(incompleteQaAgentsToday)}
              </p>
            ) : (
              <p>All active agents have Daily QA completed for today.</p>
            )}
          </div>
          <form onSubmit={onQaSubmit} className="form-grid">
            <Field>
              <FieldLabel>Agent</FieldLabel>
              <Select
                value={qaForm.agentId}
                onChange={(e) => setQaForm((prev) => ({ ...prev, agentId: e.target.value }))}
              >
                <option value="">Select agent</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel>Client Name</FieldLabel>
              <Input
                value={qaForm.clientName}
                onChange={(e) => setQaForm((prev) => ({ ...prev, clientName: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>Decision</FieldLabel>
              <Select
                value={qaForm.decision}
                onChange={(e) => setQaForm((prev) => ({ ...prev, decision: e.target.value }))}
              >
                <option>Good Sale</option>
                <option>Check Recording</option>
              </Select>
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                value={qaForm.notes}
                onChange={(e) => setQaForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </Field>
            <Button type="submit" variant="default" className="w-fit">
              Save QA
            </Button>
          </form>
        </Card>
      )}

      {taskPage === 'audit' && (
        <Card className="space-y-4">
          <CardTitle>Action Needed Audit</CardTitle>
          <div className="control-bar">
            <strong>Action Needed Audit Completion</strong>
            {incompleteAuditAgentsToday.length > 0 ? (
              <p>
                Missing ({incompleteAuditAgentsToday.length}):{' '}
                {renderMissingNames(incompleteAuditAgentsToday)}
              </p>
            ) : (
              <p>All active agents have Action Needed Audit completed for today.</p>
            )}
          </div>
          <form onSubmit={onAuditSubmit} className="form-grid">
            <Field>
              <FieldLabel>Agent</FieldLabel>
              <Select
                value={auditForm.agentId}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, agentId: e.target.value }))}
              >
                <option value="">Select agent</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel>Carrier</FieldLabel>
              <Select
                value={auditForm.carrier}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, carrier: e.target.value }))}
              >
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel>Client Name</FieldLabel>
              <Input
                value={auditForm.clientName}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, clientName: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Input
                value={auditForm.reason}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>Policy/DEN Status</FieldLabel>
              <Select
                value={auditForm.currentStatus}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, currentStatus: e.target.value }))}
              >
                {POLICY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="default" className="w-fit">
              Save Audit Entry
            </Button>
            <Button type="button" variant="secondary" className="w-fit" onClick={onAuditNoActionSubmit}>
              Mark No Action Needed
            </Button>
          </form>
        </Card>
      )}

      {taskPage === 'targets' && (
        <Card className="space-y-4">
          <CardTitle>Weekly Targets</CardTitle>
          <p className="text-sm text-slate-500">Set the current week sales and CPA goals here.</p>
          <WeeklyTargetEditor target={weekTarget} onSave={onSaveWeeklyTarget} />
        </Card>
      )}
    </div>
  )
}
