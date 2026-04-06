import { useMemo, useState } from 'react'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Tabs, Textarea } from '../components'
import { POLICY_STATUSES } from '../constants'
import type { AuditRecord, QaRecord, ShadowLog, VaultMeeting } from '../types'
import { formatNum, formatTimestamp } from '../utils'

type AgentWeekRow = {
  dayLabel: string
  dateKey: string
  sales: number
  calls: number
  marketing: number
  cpa: number | null
}

type Props = {
  activeAgents: Array<{ id: string; name: string }>
  agentPageAgentId: string
  setAgentPageAgentId: (id: string) => void
  selectedAgentWeekKey: string
  setSelectedAgentWeekKey: (key: string) => void
  eodWeekOptions: Array<{ weekKey: string; label: string }>
  agentWeekRows: AgentWeekRow[]
  qaHistoryRows: QaRecord[]
  auditHistoryRows: AuditRecord[]
  vaultDocs: Array<{ id: string; agentId: string; fileName: string; fileSize: number; uploadedAt: string }>
  vaultMeetings: VaultMeeting[]
  meetingForm: { dateKey: string; meetingType: VaultMeeting['meetingType']; notes: string; actionItems: string }
  setMeetingForm: React.Dispatch<React.SetStateAction<{ dateKey: string; meetingType: VaultMeeting['meetingType']; notes: string; actionItems: string }>>
  shadowLogsByDateForAgent: Map<string, ShadowLog[]>
  lastPoliciesBotRun: string | null
  onUpdateQaRecord: (
    recordId: string,
    patch: Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'>,
  ) => void
  onUpdateAuditRecord: (
    recordId: string,
    patch: Pick<AuditRecord, 'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'>,
  ) => void
  onDeleteAuditRecord: (recordId: string) => void
  onAddMeeting: (e: React.FormEvent) => void
  onUpdateMeeting: (
    meetingId: string,
    patch: Pick<VaultMeeting, 'dateKey' | 'meetingType' | 'notes' | 'actionItems'>,
  ) => void
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onStartShadow: (managerName: string) => void
  onAddCall: () => void
  onEndShadowLog: (logId: string) => void
  onDeleteShadowLog: (logId: string) => void
  onShadowInteraction: () => void
  onDeleteShadowCall: (logId: string, callId: string) => void
  onUpdateShadowCall: (
    logId: string,
    callId: string,
    patch: Partial<{ notes: string; coaching: string; durationMinutes: number | null; sale: boolean }>,
  ) => void
  todayKey: string
}

const AGENT_TABS = [
  { key: 'overview', label: 'Shadow' },
  { key: 'qa-history', label: 'Daily QA History' },
  { key: 'audit-history', label: 'Action Needed History' },
  { key: 'performance', label: 'Performance' },
] as const
type AgentTab = (typeof AGENT_TABS)[number]['key']
const AUDIT_STATUS_OPTIONS = [...POLICY_STATUSES, 'no_action_needed']

export function AgentPage({
  activeAgents,
  agentPageAgentId,
  setAgentPageAgentId,
  selectedAgentWeekKey,
  setSelectedAgentWeekKey,
  eodWeekOptions,
  agentWeekRows,
  qaHistoryRows,
  auditHistoryRows,
  vaultDocs,
  vaultMeetings,
  meetingForm,
  setMeetingForm,
  shadowLogsByDateForAgent,
  lastPoliciesBotRun,
  onUpdateQaRecord,
  onUpdateAuditRecord,
  onDeleteAuditRecord,
  onAddMeeting,
  onUpdateMeeting,
  onPdfUpload,
  onStartShadow,
  onAddCall,
  onEndShadowLog,
  onDeleteShadowLog,
  onShadowInteraction,
  onDeleteShadowCall,
  onUpdateShadowCall,
  todayKey,
}: Props) {
  const [managerName, setManagerName] = useState('')
  const [agentTab, setAgentTab] = useState<AgentTab>('overview')
  const [editingQaId, setEditingQaId] = useState<string | null>(null)
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null)
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const [qaDraft, setQaDraft] = useState<Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'> | null>(null)
  const [auditDraft, setAuditDraft] = useState<
    Pick<AuditRecord, 'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'> | null
  >(null)
  const [meetingDraft, setMeetingDraft] = useState<
    Pick<VaultMeeting, 'dateKey' | 'meetingType' | 'notes' | 'actionItems'> | null
  >(null)
  const [editError, setEditError] = useState<string | null>(null)
  const selectedAgentName = activeAgents.find((a) => a.id === agentPageAgentId)?.name ?? 'N/A'
  const currentDateKey = todayKey
  const shadowLogs = shadowLogsByDateForAgent.get(currentDateKey ?? '') ?? []
  const activeLog = shadowLogs.find((log) => log.endedAt === null) ?? null
  const groupedDates = useMemo(
    () => [...shadowLogsByDateForAgent.keys()].sort((a, b) => b.localeCompare(a)),
    [shadowLogsByDateForAgent],
  )
  const agentMeetings = useMemo(
    () => vaultMeetings.filter((m) => m.agentId === agentPageAgentId).sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [vaultMeetings, agentPageAgentId],
  )
  const agentDocs = useMemo(
    () => vaultDocs.filter((d) => d.agentId === agentPageAgentId),
    [vaultDocs, agentPageAgentId],
  )

  const toLocalDateTimeInput = (iso: string | null): string => {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const fromLocalDateTimeInput = (value: string): string | null => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
  }

  const cancelQaEdit = (): void => {
    setEditingQaId(null)
    setQaDraft(null)
    setEditError(null)
  }

  const saveQaEdit = (): void => {
    if (!editingQaId || !qaDraft) return
    const clientName = qaDraft.clientName.trim()
    if (!clientName) {
      setEditError('QA client name is required.')
      return
    }
    onUpdateQaRecord(editingQaId, { ...qaDraft, clientName, notes: qaDraft.notes.trim() })
    cancelQaEdit()
  }

  const cancelAuditEdit = (): void => {
    setEditingAuditId(null)
    setAuditDraft(null)
    setEditError(null)
  }

  const saveAuditEdit = (): void => {
    if (!editingAuditId || !auditDraft) return
    const clientName = auditDraft.clientName.trim()
    const carrier = auditDraft.carrier.trim()
    if (!clientName) {
      setEditError('Audit client name is required.')
      return
    }
    if (!carrier) {
      setEditError('Audit carrier is required.')
      return
    }
    onUpdateAuditRecord(editingAuditId, { ...auditDraft, clientName, carrier })
    cancelAuditEdit()
  }

  const cancelMeetingEdit = (): void => {
    setEditingMeetingId(null)
    setMeetingDraft(null)
    setEditError(null)
  }

  const saveMeetingEdit = (): void => {
    if (!editingMeetingId || !meetingDraft) return
    onUpdateMeeting(editingMeetingId, {
      ...meetingDraft,
      notes: meetingDraft.notes.trim(),
      actionItems: meetingDraft.actionItems.trim(),
    })
    cancelMeetingEdit()
  }

  return (
    <div className="page-grid gap-4 xl:gap-5">
      <Card className="space-y-4">
        <CardTitle>Agent Focus</CardTitle>
        <div className="control-bar grid gap-3 md:grid-cols-2">
          <Field className="w-full min-w-0">
              <FieldLabel>Agent</FieldLabel>
              <Select value={agentPageAgentId} onChange={(e) => setAgentPageAgentId(e.target.value)}>
                {activeAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
          </Field>
        </div>
        <Tabs value={agentTab} onChange={(value) => setAgentTab(value as AgentTab)} items={AGENT_TABS.map((tab) => ({ key: tab.key, label: tab.label }))} />
      </Card>

      {editError ? <p className="text-sm text-red-600">{editError}</p> : null}

      {agentTab === 'overview' && (
        <>
          <Card className="space-y-3.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <CardTitle>Weekly KPI Calendar (M-F)</CardTitle>
              <Field className="w-full min-w-0 md:w-[280px]">
                <FieldLabel>Week</FieldLabel>
                <Select value={selectedAgentWeekKey} onChange={(e) => setSelectedAgentWeekKey(e.target.value)}>
                  {eodWeekOptions.map((option) => (
                    <option key={option.weekKey} value={option.weekKey}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {agentWeekRows.map((row) => (
                <div
                  key={row.dateKey}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
                >
                  <div className="mb-2 flex items-start justify-between border-b border-slate-200 pb-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{row.dayLabel.slice(0, 3)}</p>
                      <p className="text-[11px] text-slate-500">{row.dateKey}</p>
                    </div>
                    <p className="text-base font-semibold leading-none text-slate-900">{row.sales}</p>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <p className="flex items-center justify-between">
                      <span className="text-slate-500">Calls</span>
                      <span className="tabular-nums">{row.calls}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-500">Mkt</span>
                      <span className="tabular-nums">${formatNum(row.marketing, 0)}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-500">CPA</span>
                      <span className="tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3.5">
        <CardTitle>Shadow Log</CardTitle>
        {!activeLog ? (
          <div className="row-wrap control-bar">
            <Field className="w-full min-w-0 sm:min-w-[260px]">
              <FieldLabel>Manager Name</FieldLabel>
              <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Enter manager name" />
            </Field>
            <Button type="button" onClick={() => onStartShadow(managerName)} disabled={!managerName.trim() || !!activeLog}>
              Start Shadow
            </Button>
          </div>
        ) : null}
        <p className="text-sm text-slate-600">Current agent: {selectedAgentName}</p>

        {groupedDates.map((dateKey) => {
          const logs = shadowLogsByDateForAgent.get(dateKey) ?? []
          return (
            <div key={dateKey} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{dateKey}</h3>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="space-y-2 rounded-lg border border-slate-200 p-3"
                  onMouseDownCapture={onShadowInteraction}
                  onFocusCapture={onShadowInteraction}
                  onBlurCapture={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onShadowInteraction()
                  }}
                >
                  {log.endedAt !== null ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-slate-600">
                        {formatTimestamp(log.endedAt)} | {log.managerName}
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">
                            Manager: {log.managerName} | Start: {formatTimestamp(log.startedAt)} | End:{' '}
                            {formatTimestamp(log.endedAt)}
                          </p>
                          <div className="row-wrap items-center gap-2">
                            <p className="text-xs text-slate-500">Last Saved: {formatTimestamp(log.updatedAt)}</p>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => {
                                if (!window.confirm('Delete this shadow session? This cannot be undone.')) return
                                onDeleteShadowLog(log.id)
                              }}
                            >
                              Delete Session
                            </Button>
                          </div>
                        </div>
                        <TableWrap>
                          <DataTable>
                            <thead>
                              <tr>
                                <th>Notes</th>
                                <th>Coaching</th>
                                <th>Duration</th>
                                <th>Sale</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {log.calls.map((call) => (
                                <tr key={call.id}>
                                  <td>
                                    <Textarea className="min-h-[72px]" value={call.notes} disabled />
                                  </td>
                                  <td>
                                    <Textarea className="min-h-[72px]" value={call.coaching} disabled />
                                  </td>
                                  <td>
                                    <Input type="number" min={0} value={call.durationMinutes ?? ''} disabled />
                                  </td>
                                  <td className="text-center">
                                    <input type="checkbox" checked={call.sale} disabled />
                                  </td>
                                  <td className="text-right">
                                    <Button type="button" variant="danger" disabled>
                                      Delete
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              {log.calls.length === 0 && (
                                <tr>
                                  <td colSpan={5}>N/A</td>
                                </tr>
                              )}
                            </tbody>
                          </DataTable>
                        </TableWrap>
                      </div>
                    </details>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          Manager: {log.managerName} | Start: {formatTimestamp(log.startedAt)} | End: Active
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Live
                        </span>
                        <p className="text-xs text-slate-500">Last Saved: {formatTimestamp(log.updatedAt)}</p>
                      </div>
                      <TableWrap>
                        <DataTable>
                          <thead>
                            <tr>
                              <th>Notes</th>
                              <th>Coaching</th>
                              <th>Duration</th>
                              <th>Sale</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {log.calls.map((call) => (
                              <tr key={call.id}>
                                <td>
                                  <Textarea
                                    className="min-h-[72px]"
                                    value={call.notes}
                                    onChange={(e) => onUpdateShadowCall(log.id, call.id, { notes: e.target.value })}
                                  />
                                </td>
                                <td>
                                  <Textarea
                                    className="min-h-[72px]"
                                    value={call.coaching}
                                    onChange={(e) => onUpdateShadowCall(log.id, call.id, { coaching: e.target.value })}
                                  />
                                </td>
                                <td>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={call.durationMinutes ?? ''}
                                    onChange={(e) =>
                                      onUpdateShadowCall(log.id, call.id, {
                                        durationMinutes: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  />
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={call.sale}
                                    onChange={(e) => onUpdateShadowCall(log.id, call.id, { sale: e.target.checked })}
                                  />
                                </td>
                                <td className="text-right">
                                  <Button type="button" variant="danger" onClick={() => onDeleteShadowCall(log.id, call.id)}>
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {log.calls.length === 0 && (
                              <tr>
                                <td colSpan={5}>N/A</td>
                              </tr>
                            )}
                          </tbody>
                        </DataTable>
                      </TableWrap>
                      <div className="row-wrap pt-2">
                        <Button type="button" variant="secondary" onClick={onAddCall}>
                          Add Call
                        </Button>
                        <Button type="button" variant="danger" onClick={() => onEndShadowLog(log.id)}>
                          End Shadow
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => {
                            if (!window.confirm('Delete this shadow session? This cannot be undone.')) return
                            onDeleteShadowLog(log.id)
                          }}
                        >
                          Delete Session
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )
        })}
          </Card>
        </>
      )}

      {agentTab === 'qa-history' && (
        <Card className="space-y-3.5">
          <CardTitle>Daily QA History</CardTitle>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Decision</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {qaHistoryRows.length === 0 && (
                  <tr>
                    <td colSpan={6}>N/A</td>
                  </tr>
                )}
                {qaHistoryRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editingQaId === row.id && qaDraft ? (
                        <Input type="date" value={qaDraft.dateKey} onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, dateKey: e.target.value } : prev))} />
                      ) : (
                        row.dateKey
                      )}
                    </td>
                    <td>
                      {editingQaId === row.id && qaDraft ? (
                        <Input value={qaDraft.clientName} onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, clientName: e.target.value } : prev))} />
                      ) : (
                        row.clientName
                      )}
                    </td>
                    <td>
                      {editingQaId === row.id && qaDraft ? (
                        <Select value={qaDraft.decision} onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, decision: e.target.value as QaRecord['decision'] } : prev))}>
                          <option value="Good Sale">Good Sale</option>
                          <option value="Check Recording">Check Recording</option>
                        </Select>
                      ) : (
                        row.decision
                      )}
                    </td>
                    <td>
                      {editingQaId === row.id && qaDraft ? (
                        <Select value={qaDraft.status} onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, status: e.target.value as QaRecord['status'] } : prev))}>
                          <option value="Good">Good</option>
                          <option value="Check Recording">Check Recording</option>
                          <option value="Resolved">Resolved</option>
                        </Select>
                      ) : (
                        row.status
                      )}
                    </td>
                    <td>
                      {editingQaId === row.id && qaDraft ? (
                        <Input value={qaDraft.notes} onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} />
                      ) : (
                        row.notes || 'N/A'
                      )}
                    </td>
                    <td>
                      {editingQaId === row.id ? (
                        <div className="flex gap-2">
                          <Button variant="default" className="h-8 px-2.5 py-1 text-xs" onClick={saveQaEdit}>Save</Button>
                          <Button variant="secondary" className="h-8 px-2.5 py-1 text-xs" onClick={cancelQaEdit}>Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          className="h-8 px-2.5 py-1 text-xs"
                          onClick={() => {
                            setEditingQaId(row.id)
                            setQaDraft({
                              agentId: row.agentId,
                              dateKey: row.dateKey,
                              clientName: row.clientName,
                              decision: row.decision,
                              status: row.status,
                              notes: row.notes,
                            })
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Card>
      )}

      {agentTab === 'audit-history' && (
        <Card className="space-y-3.5">
          <CardTitle>Action Needed History</CardTitle>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Discovered</th>
                  <th>Carrier</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Last parsed</th>
                  <th>Timestamp 2</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {auditHistoryRows.length === 0 && (
                  <tr>
                    <td colSpan={8}>N/A</td>
                  </tr>
                )}
                {auditHistoryRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTimestamp(row.discoveryTs)}</td>
                    <td>{row.carrier}</td>
                    <td>{row.clientName}</td>
                    <td>
                      {editingAuditId === row.id && auditDraft ? (
                        <Select
                          value={auditDraft.currentStatus}
                          onChange={(e) => setAuditDraft((prev) => (prev ? { ...prev, currentStatus: e.target.value } : prev))}
                        >
                          {AUDIT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        row.currentStatus
                      )}
                    </td>
                    <td>{lastPoliciesBotRun ? formatTimestamp(lastPoliciesBotRun) : 'Never'}</td>
                    <td>
                      {editingAuditId === row.id && auditDraft ? (
                        <Input
                          type="datetime-local"
                          value={toLocalDateTimeInput(auditDraft.resolutionTs)}
                          onChange={(e) => setAuditDraft((prev) => (prev ? { ...prev, resolutionTs: fromLocalDateTimeInput(e.target.value) } : prev))}
                        />
                      ) : (
                        formatTimestamp(row.resolutionTs)
                      )}
                    </td>
                    <td>
                      {editingAuditId === row.id && auditDraft ? (
                        <Input value={auditDraft.notes ?? ''} onChange={(e) => setAuditDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} />
                      ) : (
                        row.notes || 'N/A'
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {editingAuditId === row.id ? (
                          <>
                            <Button variant="default" className="h-8 px-2.5 py-1 text-xs" onClick={saveAuditEdit}>Save</Button>
                            <Button variant="secondary" className="h-8 px-2.5 py-1 text-xs" onClick={cancelAuditEdit}>Cancel</Button>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            className="h-8 px-2.5 py-1 text-xs"
                            onClick={() => {
                              setEditingAuditId(row.id)
                              setAuditDraft({
                                agentId: row.agentId,
                                discoveryTs: row.discoveryTs,
                                carrier: row.carrier,
                                clientName: row.clientName,
                                currentStatus: row.currentStatus,
                                resolutionTs: row.resolutionTs,
                                notes: row.notes,
                              })
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        <Button variant="danger" onClick={() => onDeleteAuditRecord(row.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Card>
      )}

      {agentTab === 'performance' && (
        <>
          <Card className="space-y-3.5 bg-slate-50">
            <CardTitle>Performance Meeting</CardTitle>
            <form onSubmit={onAddMeeting} className="form-grid">
              <Field>
                <FieldLabel>Date</FieldLabel>
                <Input value={meetingForm.dateKey} onChange={(e) => setMeetingForm((prev) => ({ ...prev, dateKey: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={meetingForm.meetingType} onChange={(e) => setMeetingForm((prev) => ({ ...prev, meetingType: e.target.value as VaultMeeting['meetingType'] }))}>
                  <option>Coaching</option>
                  <option>Warning</option>
                  <option>Review</option>
                  <option>Transfer</option>
                </Select>
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <Textarea value={meetingForm.notes} onChange={(e) => setMeetingForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel>Action Items</FieldLabel>
                <Textarea value={meetingForm.actionItems} onChange={(e) => setMeetingForm((prev) => ({ ...prev, actionItems: e.target.value }))} />
              </Field>
              <Button type="submit" variant="default" className="h-8 w-fit px-2.5 py-1 text-xs">Save Meeting</Button>
            </form>
          </Card>

          <div className="split gap-3.5">
            <Card className="space-y-3 bg-slate-50">
              <h3>PDF Uploads</h3>
              <Input type="file" accept=".pdf,application/pdf" onChange={onPdfUpload} className="h-auto py-2" />
              <ul className="grid gap-2">
                {agentDocs.map((doc) => (
                  <li key={doc.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
                    {doc.fileName} ({Math.round(doc.fileSize / 1024)} KB) - {formatTimestamp(doc.uploadedAt)}
                  </li>
                ))}
                {agentDocs.length === 0 && <li className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">N/A</li>}
              </ul>
            </Card>

            <Card className="space-y-3 bg-slate-50">
              <h3>Meeting Log</h3>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Notes</th>
                      <th>Action Items</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentMeetings.length === 0 && (
                      <tr>
                        <td colSpan={5}>No meetings logged.</td>
                      </tr>
                    )}
                    {agentMeetings.map((meeting) => (
                      <tr key={meeting.id}>
                        <td>
                          {editingMeetingId === meeting.id && meetingDraft ? (
                            <Input type="date" value={meetingDraft.dateKey} onChange={(e) => setMeetingDraft((prev) => (prev ? { ...prev, dateKey: e.target.value } : prev))} />
                          ) : (
                            meeting.dateKey
                          )}
                        </td>
                        <td>
                          {editingMeetingId === meeting.id && meetingDraft ? (
                            <Select value={meetingDraft.meetingType} onChange={(e) => setMeetingDraft((prev) => (prev ? { ...prev, meetingType: e.target.value as VaultMeeting['meetingType'] } : prev))}>
                              <option value="Coaching">Coaching</option>
                              <option value="Warning">Warning</option>
                              <option value="Review">Review</option>
                              <option value="Transfer">Transfer</option>
                            </Select>
                          ) : (
                            meeting.meetingType
                          )}
                        </td>
                        <td>
                          {editingMeetingId === meeting.id && meetingDraft ? (
                            <Textarea value={meetingDraft.notes} onChange={(e) => setMeetingDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} rows={2} />
                          ) : (
                            meeting.notes || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingMeetingId === meeting.id && meetingDraft ? (
                            <Textarea value={meetingDraft.actionItems} onChange={(e) => setMeetingDraft((prev) => (prev ? { ...prev, actionItems: e.target.value } : prev))} rows={2} />
                          ) : (
                            meeting.actionItems || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingMeetingId === meeting.id ? (
                            <div className="flex gap-2">
                              <Button variant="default" className="h-8 px-2.5 py-1 text-xs" onClick={saveMeetingEdit}>Save</Button>
                              <Button variant="secondary" className="h-8 px-2.5 py-1 text-xs" onClick={cancelMeetingEdit}>Cancel</Button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              className="h-8 px-2.5 py-1 text-xs"
                              onClick={() => {
                                setEditingMeetingId(meeting.id)
                                setMeetingDraft({
                                  dateKey: meeting.dateKey,
                                  meetingType: meeting.meetingType,
                                  notes: meeting.notes,
                                  actionItems: meeting.actionItems,
                                })
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Card>
          </div>
        </>
      )}

    </div>
  )
}
