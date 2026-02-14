import { WeeklyTargetEditor } from '../components'
import { CARRIERS, POLICY_STATUSES } from '../constants'
import type { AttendanceRecord } from '../types'
import type { AttendancePercent } from '../types'
import type { DataStore } from '../data'

type Props = {
  taskPage: 'attendance' | 'qa' | 'audit' | 'targets'
  setTaskPage: (p: 'attendance' | 'qa' | 'audit' | 'targets') => void
  activeAgents: DataStore['agents']
  attendance: AttendanceRecord[]
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
  onSaveWeeklyTarget: (sales: number, cpa: number) => void
  onQaSubmit: (e: React.FormEvent) => void
  onAuditSubmit: (e: React.FormEvent) => void
}

export function TasksPage({
  taskPage,
  setTaskPage,
  activeAgents,
  attendance,
  weekDates,
  weekTarget,
  qaForm,
  setQaForm,
  auditForm,
  setAuditForm,
  incompleteQaAgentsToday,
  incompleteAuditAgentsToday,
  onSetAttendancePercent,
  onSaveWeeklyTarget,
  onQaSubmit,
  onAuditSubmit,
}: Props) {
  return (
    <>
      <section className="panel">
        <div className="row gap-sm">
          <button
            className={taskPage === 'attendance' ? 'active-btn' : ''}
            onClick={() => setTaskPage('attendance')}
          >
            Attendance
          </button>
          <button className={taskPage === 'qa' ? 'active-btn' : ''} onClick={() => setTaskPage('qa')}>
            Daily QA
          </button>
          <button className={taskPage === 'audit' ? 'active-btn' : ''} onClick={() => setTaskPage('audit')}>
            Action Needed Audit
          </button>
          <button className={taskPage === 'targets' ? 'active-btn' : ''} onClick={() => setTaskPage('targets')}>
            Weekly Targets
          </button>
        </div>
      </section>

      {taskPage === 'attendance' && (
        <section className="panel">
          <h2>Attendance (Mon-Fri)</h2>
          <div className="table-wrap">
            <table>
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
                          <select
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
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {taskPage === 'qa' && (
        <section className="panel">
          <h2>Daily QA Log</h2>
          <div className="panel">
            <strong>Daily QA Completion</strong>
            {incompleteQaAgentsToday.length > 0 ? (
              <p>
                Missing ({incompleteQaAgentsToday.length}): {incompleteQaAgentsToday.map((a) => a.name).join(', ')}
              </p>
            ) : (
              <p>All active agents have Daily QA completed for today.</p>
            )}
          </div>
          <form onSubmit={onQaSubmit} className="form-grid">
            <label>
              Agent
              <select
                value={qaForm.agentId}
                onChange={(e) => setQaForm((prev) => ({ ...prev, agentId: e.target.value }))}
              >
                <option value="">Select agent</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client Name
              <input
                value={qaForm.clientName}
                onChange={(e) => setQaForm((prev) => ({ ...prev, clientName: e.target.value }))}
              />
            </label>
            <label>
              Decision
              <select
                value={qaForm.decision}
                onChange={(e) => setQaForm((prev) => ({ ...prev, decision: e.target.value }))}
              >
                <option>Good Sale</option>
                <option>Check Recording</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                value={qaForm.notes}
                onChange={(e) => setQaForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>
            <button type="submit">Save QA</button>
          </form>
        </section>
      )}

      {taskPage === 'audit' && (
        <section className="panel">
          <h2>Action Needed Audit</h2>
          <div className="panel">
            <strong>Action Needed Audit Completion</strong>
            {incompleteAuditAgentsToday.length > 0 ? (
              <p>
                Missing ({incompleteAuditAgentsToday.length}):{' '}
                {incompleteAuditAgentsToday.map((a) => a.name).join(', ')}
              </p>
            ) : (
              <p>All active agents have Action Needed Audit completed for today.</p>
            )}
          </div>
          <form onSubmit={onAuditSubmit} className="form-grid">
            <label>
              Agent
              <select
                value={auditForm.agentId}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, agentId: e.target.value }))}
              >
                <option value="">Select agent</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Carrier
              <select
                value={auditForm.carrier}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, carrier: e.target.value }))}
              >
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client Name
              <input
                value={auditForm.clientName}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, clientName: e.target.value }))}
              />
            </label>
            <label>
              Reason
              <input
                value={auditForm.reason}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </label>
            <label>
              Policy/DEN Status
              <select
                value={auditForm.currentStatus}
                onChange={(e) => setAuditForm((prev) => ({ ...prev, currentStatus: e.target.value }))}
              >
                {POLICY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Save Audit Entry</button>
          </form>
        </section>
      )}

      {taskPage === 'targets' && (
        <section className="panel">
          <h2>Weekly Targets</h2>
          <p className="muted">Set the current week sales and CPA goals here.</p>
          <WeeklyTargetEditor target={weekTarget} onSave={onSaveWeeklyTarget} />
        </section>
      )}
    </>
  )
}
