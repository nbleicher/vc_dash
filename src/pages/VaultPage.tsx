import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DataStore } from '../data'
import { Badge, Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Textarea } from '../components'
import type { VaultHistoryView, VaultScope, VaultMeeting } from '../types'
import { formatDateKey, formatNum, formatPctDelta, formatTimestamp } from '../utils'

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
  onAddMeeting: (e: React.FormEvent) => void
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const PAGE_SIZE = 50

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
  vaultAttendanceHistory,
  vaultQaHistory,
  vaultAuditHistory,
  weeklyTargetHistory,
  onAddMeeting,
  onPdfUpload,
}: Props) {
  const [fullTableMode, setFullTableMode] = useState<'qa' | 'audit' | null>(null)
  const [popupSearch, setPopupSearch] = useState('')
  const [popupPage, setPopupPage] = useState(1)

  const agentNameById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents])
  const agentName = useCallback((agentId: string): string => agentNameById.get(agentId) ?? 'Unknown', [agentNameById])

  useEffect(() => {
    if (!fullTableMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullTableMode(null)
        setPopupPage(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullTableMode])

  const qaFilteredRows = useMemo(() => {
    const q = popupSearch.trim().toLowerCase()
    if (!q) return vaultQaHistory
    return vaultQaHistory.filter((row) =>
      [agentName(row.agentId), formatDateKey(row.dateKey), row.clientName, row.decision, row.status, row.notes]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [popupSearch, vaultQaHistory, agentName])

  const auditFilteredRows = useMemo(() => {
    const q = popupSearch.trim().toLowerCase()
    if (!q) return vaultAuditHistory
    return vaultAuditHistory.filter((row) =>
      [agentName(row.agentId), formatTimestamp(row.discoveryTs), row.carrier, row.clientName, row.currentStatus]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [popupSearch, vaultAuditHistory, agentName])

  const filteredRowsCount = fullTableMode === 'qa' ? qaFilteredRows.length : auditFilteredRows.length
  const totalPages = Math.max(1, Math.ceil(filteredRowsCount / PAGE_SIZE))
  const safePage = Math.min(popupPage, totalPages)
  const start = (safePage - 1) * PAGE_SIZE

  const qaPagedRows = qaFilteredRows.slice(start, start + PAGE_SIZE)
  const auditPagedRows = auditFilteredRows.slice(start, start + PAGE_SIZE)

  const renderQaHistoryCard = (rows: Props['vaultQaHistory'], showFullAction = false) => (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3>Daily QA History</h3>
        {showFullAction ? (
          <Button
            variant="secondary"
            onClick={() => {
              setFullTableMode('qa')
              setPopupPage(1)
            }}
          >
            View Full Table
          </Button>
        ) : null}
      </div>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>N/A</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{agentName(row.agentId)}</td>
                <td>{formatDateKey(row.dateKey)}</td>
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
  )

  const renderAuditHistoryCard = (rows: Props['vaultAuditHistory'], showFullAction = false) => (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3>Action Needed History</h3>
        {showFullAction ? (
          <Button
            variant="secondary"
            onClick={() => {
              setFullTableMode('audit')
              setPopupPage(1)
            }}
          >
            View Full Table
          </Button>
        ) : null}
      </div>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>N/A</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{agentName(row.agentId)}</td>
                <td>{formatTimestamp(row.discoveryTs)}</td>
                <td>{row.carrier}</td>
                <td>{row.clientName}</td>
                <td>
                  {row.currentStatus === 'no_action_needed' ? (
                    <Badge variant="success">No Action Needed</Badge>
                  ) : (
                    <Badge variant="warning">Needs Review</Badge>
                  )}
                </td>
                <td>{formatTimestamp(row.discoveryTs)}</td>
                <td>{formatTimestamp(row.resolutionTs)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrap>
    </Card>
  )

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
        {vaultScope === 'agent' ? (
          <>
            <Field className="min-w-[220px]">
              <FieldLabel>Agent</FieldLabel>
              <Select value={effectiveVaultAgentId} onChange={(e) => setVaultAgentId(e.target.value)}>
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
          </>
        ) : null}
        <Field className="min-w-[180px]">
          <FieldLabel>Sort</FieldLabel>
          <Select value={historySort} onChange={(e) => setHistorySort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </Field>
      </div>
      {vaultScope === 'house' ? (
        <div className="split">
          {renderQaHistoryCard(vaultQaHistory, true)}
          {renderAuditHistoryCard(vaultAuditHistory, true)}
        </div>
      ) : !selectedVaultAgent ? (
        <p className="text-sm text-slate-500">N/A - add/select an active agent.</p>
      ) : (
        <>
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
                    <option>Transfer</option>
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
                    {formatDateKey(m.dateKey)} - {m.meetingType} - {m.notes || 'N/A'}
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
                        <td>{formatDateKey(row.dateKey)}</td>
                        <td className="text-right tabular-nums">{row.percent}%</td>
                        <td>{row.notes || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Card>
          )}

          {vaultHistoryView === 'qa' && renderQaHistoryCard(vaultQaHistory)}

          {vaultHistoryView === 'audit' && renderAuditHistoryCard(vaultAuditHistory)}

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
                        <td>{formatDateKey(row.weekKey)}</td>
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

      {fullTableMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <Card className="max-h-[88vh] w-full max-w-7xl overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3>{fullTableMode === 'qa' ? 'Daily QA History' : 'Action Needed History'} - Full Table</h3>
              <Button
                variant="secondary"
                onClick={() => {
                  setFullTableMode(null)
                  setPopupSearch('')
                  setPopupPage(1)
                }}
              >
                Close
              </Button>
            </div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <Field className="min-w-[320px]">
                <FieldLabel>Search</FieldLabel>
                <Input
                  placeholder="Search by agent, date, client, status, notes..."
                  value={popupSearch}
                  onChange={(e) => {
                    setPopupSearch(e.target.value)
                    setPopupPage(1)
                  }}
                />
              </Field>
              <p className="text-sm text-slate-500">
                Showing {filteredRowsCount === 0 ? 0 : start + 1}-{Math.min(start + PAGE_SIZE, filteredRowsCount)} of{' '}
                {filteredRowsCount}
              </p>
            </div>
            <TableWrap className="max-h-[58vh]">
              {fullTableMode === 'qa' ? (
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
                    {qaPagedRows.length === 0 && (
                      <tr>
                        <td colSpan={6}>No QA rows match this search.</td>
                      </tr>
                    )}
                    {qaPagedRows.map((row) => (
                      <tr key={row.id}>
                        <td>{agentName(row.agentId)}</td>
                        <td>{formatDateKey(row.dateKey)}</td>
                        <td>{row.clientName}</td>
                        <td>{row.decision}</td>
                        <td>{row.status}</td>
                        <td>{row.notes || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              ) : (
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
                    {auditPagedRows.length === 0 && (
                      <tr>
                        <td colSpan={7}>No audit rows match this search.</td>
                      </tr>
                    )}
                    {auditPagedRows.map((row) => (
                      <tr key={row.id}>
                        <td>{agentName(row.agentId)}</td>
                        <td>{formatTimestamp(row.discoveryTs)}</td>
                        <td>{row.carrier}</td>
                        <td>{row.clientName}</td>
                        <td>
                          {row.currentStatus === 'no_action_needed' ? (
                            <Badge variant="success">No Action Needed</Badge>
                          ) : (
                            <Badge variant="warning">Needs Review</Badge>
                          )}
                        </td>
                        <td>{formatTimestamp(row.discoveryTs)}</td>
                        <td>{formatTimestamp(row.resolutionTs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </TableWrap>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="secondary" disabled={safePage <= 1} onClick={() => setPopupPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={safePage >= totalPages}
                onClick={() => setPopupPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  )
}
