import type { DataStore } from '../data'
import type { VaultHistoryView, VaultScope, VaultMeeting } from '../types'
import { formatNum, formatPctDelta, formatTimestamp } from '../utils'

type Props = {
  vaultScope: VaultScope
  setVaultScope: (s: VaultScope) => void
  setVaultAgentId: (s: string) => void
  effectiveVaultAgentId: string
  selectedVaultAgent: { id: string } | null
  activeAgents: Array<{ id: string; name: string }>
  vaultHistoryView: VaultHistoryView
  setVaultHistoryView: (v: VaultHistoryView) => void
  historySort: 'newest' | 'oldest'
  setHistorySort: (s: 'newest' | 'oldest') => void
  agents: DataStore['agents']
  vaultDocs: DataStore['vaultDocs']
  vaultMeetings: DataStore['vaultMeetings']
  meetingForm: { dateKey: string; meetingType: VaultMeeting['meetingType']; notes: string; actionItems: string }
  setMeetingForm: React.Dispatch<React.SetStateAction<{ dateKey: string; meetingType: VaultMeeting['meetingType']; notes: string; actionItems: string }>>
  attendanceNoteDraft: string
  setAttendanceNoteDraft: (s: string) => void
  vaultAttendanceHistory: Array<{ id: string; agentId: string; dateKey: string; percent: number; notes: string }>
  vaultQaHistory: Array<{
    id: string
    agentId: string
    dateKey: string
    clientName: string
    decision: string
    status: string
    notes: string
  }>
  vaultAuditHistory: Array<{
    id: string
    agentId: string
    discoveryTs: string
    carrier: string
    clientName: string
    currentStatus: string
    resolutionTs: string | null
  }>
  weeklyTargetHistory: Array<{
    weekKey: string
    targetSales: number
    targetCpa: number
    actualSales: number
    actualCpa: number | null
    salesHit: boolean
    cpaHit: boolean
    salesDeltaPct: number | null
    cpaDeltaPct: number | null
    setAt: string
  }>
  onSaveAttendanceNote: (agentId: string, dateKey: string) => void
  onAddMeeting: (e: React.FormEvent) => void
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function VaultPage({
  vaultScope,
  setVaultScope,
  setVaultAgentId,
  effectiveVaultAgentId,
  selectedVaultAgent,
  activeAgents,
  vaultHistoryView,
  setVaultHistoryView,
  historySort,
  setHistorySort,
  agents,
  vaultDocs,
  vaultMeetings,
  meetingForm,
  setMeetingForm,
  attendanceNoteDraft,
  setAttendanceNoteDraft,
  vaultAttendanceHistory,
  vaultQaHistory,
  vaultAuditHistory,
  weeklyTargetHistory,
  onSaveAttendanceNote,
  onAddMeeting,
  onPdfUpload,
}: Props) {
  return (
    <section className="panel">
      <h2>Vault</h2>
      <div className="row gap-sm vault-controls">
        <label>
          Scope
          <select value={vaultScope} onChange={(e) => setVaultScope(e.target.value as VaultScope)}>
            <option value="agent">Selected Agent</option>
            <option value="house">House (All Agents)</option>
          </select>
        </label>
        <label>
          Agent
          <select
            value={effectiveVaultAgentId}
            onChange={(e) => setVaultAgentId(e.target.value)}
            disabled={vaultScope === 'house'}
          >
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          History Type
          <select
            value={vaultHistoryView}
            onChange={(e) => setVaultHistoryView(e.target.value as VaultHistoryView)}
          >
            <option value="attendance">Attendance History</option>
            <option value="qa">Daily QA History</option>
            <option value="audit">Action Needed History</option>
            <option value="targets">Weekly Target History</option>
          </select>
        </label>
        <label>
          Sort
          <select value={historySort} onChange={(e) => setHistorySort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {!selectedVaultAgent ? (
        <p className="muted">N/A - add/select an active agent.</p>
      ) : (
        <>
          <div className="split">
            <div>
              <h3>Attendance Context Note</h3>
              <input
                value={meetingForm.dateKey}
                onChange={(e) => setMeetingForm((prev) => ({ ...prev, dateKey: e.target.value }))}
                placeholder="YYYY-MM-DD"
              />
              <textarea
                value={attendanceNoteDraft}
                onChange={(e) => setAttendanceNoteDraft(e.target.value)}
                placeholder="Attendance note"
              />
              <button onClick={() => onSaveAttendanceNote(selectedVaultAgent.id, meetingForm.dateKey)}>
                Save Attendance Note
              </button>
            </div>
            <div>
              <h3>Performance Meeting</h3>
              <form onSubmit={onAddMeeting} className="form-grid">
                <label>
                  Date
                  <input
                    value={meetingForm.dateKey}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, dateKey: e.target.value }))}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={meetingForm.meetingType}
                    onChange={(e) =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        meetingType: e.target.value as VaultMeeting['meetingType'],
                      }))
                    }
                  >
                    <option>Coaching</option>
                    <option>Warning</option>
                    <option>Review</option>
                  </select>
                </label>
                <label>
                  Notes
                  <textarea
                    value={meetingForm.notes}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </label>
                <label>
                  Action Items
                  <textarea
                    value={meetingForm.actionItems}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, actionItems: e.target.value }))}
                  />
                </label>
                <button type="submit">Save Meeting</button>
              </form>
            </div>
          </div>

          <div className="split">
            <div>
              <h3>PDF Uploads</h3>
              <input type="file" accept=".pdf,application/pdf" onChange={onPdfUpload} />
              <ul>
                {vaultDocs.filter((d) => d.agentId === selectedVaultAgent.id).map((d) => (
                  <li key={d.id}>
                    {d.fileName} ({Math.round(d.fileSize / 1024)} KB) - {formatTimestamp(d.uploadedAt)}
                  </li>
                ))}
                {vaultDocs.filter((d) => d.agentId === selectedVaultAgent.id).length === 0 && <li>N/A</li>}
              </ul>
            </div>
            <div>
              <h3>Meeting Log</h3>
              <ul>
                {vaultMeetings.filter((m) => m.agentId === selectedVaultAgent.id).map((m) => (
                  <li key={m.id}>
                    {m.dateKey} - {m.meetingType} - {m.notes || 'N/A'}
                  </li>
                ))}
                {vaultMeetings.filter((m) => m.agentId === selectedVaultAgent.id).length === 0 && <li>N/A</li>}
              </ul>
            </div>
          </div>

          {vaultHistoryView === 'attendance' && (
            <section className="panel">
              <h3>Attendance History</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Date</th>
                      <th>Percent</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultAttendanceHistory.length === 0 && (
                      <tr>
                        <td colSpan={4}>N/A</td>
                      </tr>
                    )}
                    {vaultAttendanceHistory.map((row) => (
                      <tr key={row.id}>
                        <td>{agents.find((a) => a.id === row.agentId)?.name ?? 'Unknown'}</td>
                        <td>{row.dateKey}</td>
                        <td>{row.percent}%</td>
                        <td>{row.notes || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {vaultHistoryView === 'qa' && (
            <section className="panel">
              <h3>Daily QA History</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Decision</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultQaHistory.length === 0 && (
                      <tr>
                        <td colSpan={6}>N/A</td>
                      </tr>
                    )}
                    {vaultQaHistory.map((row) => (
                      <tr key={row.id}>
                        <td>{agents.find((a) => a.id === row.agentId)?.name ?? 'Unknown'}</td>
                        <td>{row.dateKey}</td>
                        <td>{row.clientName}</td>
                        <td>{row.decision}</td>
                        <td>{row.status}</td>
                        <td>{row.notes || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {vaultHistoryView === 'audit' && (
            <section className="panel">
              <h3>Action Needed History</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Discovered</th>
                      <th>Carrier</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Timestamp 1</th>
                      <th>Timestamp 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultAuditHistory.length === 0 && (
                      <tr>
                        <td colSpan={7}>N/A</td>
                      </tr>
                    )}
                    {vaultAuditHistory.map((row) => (
                      <tr key={row.id}>
                        <td>{agents.find((a) => a.id === row.agentId)?.name ?? 'Unknown'}</td>
                        <td>{formatTimestamp(row.discoveryTs)}</td>
                        <td>{row.carrier}</td>
                        <td>{row.clientName}</td>
                        <td>{row.currentStatus}</td>
                        <td>{formatTimestamp(row.discoveryTs)}</td>
                        <td>{formatTimestamp(row.resolutionTs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {vaultHistoryView === 'targets' && (
            <section className="panel">
              <h3>Weekly Target History (House)</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Week (Mon)</th>
                      <th>Sales Goal</th>
                      <th>Actual Sales</th>
                      <th>Sales Hit?</th>
                      <th>Sales % Over/Under</th>
                      <th>CPA Goal</th>
                      <th>Actual CPA</th>
                      <th>CPA Hit?</th>
                      <th>CPA % Over/Under</th>
                      <th>Set At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyTargetHistory.length === 0 && (
                      <tr>
                        <td colSpan={10}>N/A</td>
                      </tr>
                    )}
                    {weeklyTargetHistory.map((row) => (
                      <tr key={row.weekKey}>
                        <td>{row.weekKey}</td>
                        <td>{row.targetSales}</td>
                        <td>{row.actualSales}</td>
                        <td>{row.salesHit ? 'Hit' : 'Miss'}</td>
                        <td>{formatPctDelta(row.salesDeltaPct)}</td>
                        <td>${formatNum(row.targetCpa)}</td>
                        <td>{row.actualCpa === null ? 'N/A' : `$${formatNum(row.actualCpa)}`}</td>
                        <td>{row.cpaHit ? 'Hit' : 'Miss'}</td>
                        <td>{formatPctDelta(row.cpaDeltaPct)}</td>
                        <td>{formatTimestamp(row.setAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
