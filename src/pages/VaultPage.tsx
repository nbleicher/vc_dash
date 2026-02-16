import type { DataStore } from '../data'
import { Badge, Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Textarea } from '../components'
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
    <Card className="space-y-4">
      <CardTitle>Vault</CardTitle>
      <div className="row-wrap control-bar">
        <Field className="min-w-[220px]">
          <FieldLabel>Scope</FieldLabel>
          <Select value={vaultScope} onChange={(e) => setVaultScope(e.target.value as VaultScope)}>
            <option value="agent">Selected Agent</option>
            <option value="house">House (All Agents)</option>
          </Select>
        </Field>
        <Field className="min-w-[220px]">
          <FieldLabel>Agent</FieldLabel>
          <Select
            value={effectiveVaultAgentId}
            onChange={(e) => setVaultAgentId(e.target.value)}
            disabled={vaultScope === 'house'}
          >
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="min-w-[260px]">
          <FieldLabel>History Type</FieldLabel>
          <Select
            value={vaultHistoryView}
            onChange={(e) => setVaultHistoryView(e.target.value as VaultHistoryView)}
          >
            <option value="attendance">Attendance History</option>
            <option value="qa">Daily QA History</option>
            <option value="audit">Action Needed History</option>
            <option value="targets">Weekly Target History</option>
          </Select>
        </Field>
        <Field className="min-w-[180px]">
          <FieldLabel>Sort</FieldLabel>
          <Select value={historySort} onChange={(e) => setHistorySort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </Field>
      </div>
      {!selectedVaultAgent ? (
        <p className="text-sm text-slate-500">N/A - add/select an active agent.</p>
      ) : (
        <>
          <div className="split">
            <Card className="space-y-3 bg-slate-50">
              <h3>Attendance Context Note</h3>
              <Input
                value={meetingForm.dateKey}
                onChange={(e) => setMeetingForm((prev) => ({ ...prev, dateKey: e.target.value }))}
                placeholder="YYYY-MM-DD"
              />
              <Textarea
                value={attendanceNoteDraft}
                onChange={(e) => setAttendanceNoteDraft(e.target.value)}
                placeholder="Attendance note"
              />
              <Button variant="default" onClick={() => onSaveAttendanceNote(selectedVaultAgent.id, meetingForm.dateKey)}>
                Save Attendance Note
              </Button>
            </Card>
            <Card className="bg-slate-50">
              <h3>Performance Meeting</h3>
              <form onSubmit={onAddMeeting} className="form-grid">
                <Field>
                  <FieldLabel>Date</FieldLabel>
                  <Input
                    value={meetingForm.dateKey}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, dateKey: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <Select
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
                  </Select>
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea
                    value={meetingForm.notes}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Action Items</FieldLabel>
                  <Textarea
                    value={meetingForm.actionItems}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, actionItems: e.target.value }))}
                  />
                </Field>
                <Button type="submit" variant="default" className="w-fit">
                  Save Meeting
                </Button>
              </form>
            </Card>
          </div>

          <div className="split">
            <Card className="space-y-3 bg-slate-50">
              <h3>PDF Uploads</h3>
              <Input type="file" accept=".pdf,application/pdf" onChange={onPdfUpload} className="h-auto py-2" />
              <ul className="grid gap-2">
                {vaultDocs.filter((d) => d.agentId === selectedVaultAgent.id).map((d) => (
                  <li key={d.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
                    {d.fileName} ({Math.round(d.fileSize / 1024)} KB) - {formatTimestamp(d.uploadedAt)}
                  </li>
                ))}
                {vaultDocs.filter((d) => d.agentId === selectedVaultAgent.id).length === 0 && (
                  <li className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">N/A</li>
                )}
              </ul>
            </Card>
            <Card className="space-y-3 bg-slate-50">
              <h3>Meeting Log</h3>
              <ul className="grid gap-2">
                {vaultMeetings.filter((m) => m.agentId === selectedVaultAgent.id).map((m) => (
                  <li key={m.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
                    {m.dateKey} - {m.meetingType} - {m.notes || 'N/A'}
                  </li>
                ))}
                {vaultMeetings.filter((m) => m.agentId === selectedVaultAgent.id).length === 0 && (
                  <li className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">N/A</li>
                )}
              </ul>
            </Card>
          </div>

          {vaultHistoryView === 'attendance' && (
            <Card>
              <h3>Attendance History</h3>
              <TableWrap>
                <DataTable>
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
                        <td className="text-right tabular-nums">{row.percent}%</td>
                        <td>{row.notes || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Card>
          )}

          {vaultHistoryView === 'qa' && (
            <Card>
              <h3>Daily QA History</h3>
              <TableWrap>
                <DataTable>
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
                </DataTable>
              </TableWrap>
            </Card>
          )}

          {vaultHistoryView === 'audit' && (
            <Card>
              <h3>Action Needed History</h3>
              <TableWrap>
                <DataTable>
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
                        <td>
                          <Badge variant="warning">Needs Review</Badge>
                        </td>
                        <td>{formatTimestamp(row.discoveryTs)}</td>
                        <td>{formatTimestamp(row.resolutionTs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Card>
          )}

          {vaultHistoryView === 'targets' && (
            <Card>
              <h3>Weekly Target History (House)</h3>
              <TableWrap>
                <DataTable>
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
                        <td className="text-right tabular-nums">{row.targetSales}</td>
                        <td className="text-right tabular-nums">{row.actualSales}</td>
                        <td>{row.salesHit ? <Badge variant="success">On Track</Badge> : <Badge variant="warning">Needs Review</Badge>}</td>
                        <td className="text-right tabular-nums">{formatPctDelta(row.salesDeltaPct)}</td>
                        <td className="text-right tabular-nums">${formatNum(row.targetCpa)}</td>
                        <td className="text-right tabular-nums">{row.actualCpa === null ? 'N/A' : `$${formatNum(row.actualCpa)}`}</td>
                        <td>{row.cpaHit ? <Badge variant="success">On Track</Badge> : <Badge variant="danger">Critical</Badge>}</td>
                        <td className="text-right tabular-nums">{formatPctDelta(row.cpaDeltaPct)}</td>
                        <td>{formatTimestamp(row.setAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Card>
          )}
        </>
      )}
    </Card>
  )
}
