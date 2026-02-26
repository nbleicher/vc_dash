import { useMemo, useState } from 'react'
import { WeeklyTargetEditor } from '../components'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, MetricCard, Select, TableWrap, Tabs, Textarea } from '../components'
import { CARRIERS, POLICY_STATUSES } from '../constants'
import type { AttendanceRecord, AuditRecord } from '../types'
import type { AttendancePercent } from '../types'
import type { SpiffRecord, TaskPage } from '../types'
import type { DataStore } from '../data'
import { formatDateKey, formatLastParsedDate, formatNum, formatTimestamp } from '../utils'

const AUDIT_HISTORY_PREVIEW_ROWS = 5

type Props = {
  taskPage: TaskPage
  setTaskPage: (p: TaskPage) => void
  todayKey: string
  activeAgents: DataStore['agents']
  auditRecords: AuditRecord[]
  attendance: AttendanceRecord[]
  spiffRecords: SpiffRecord[]
  attendanceSubmissions: DataStore['attendanceSubmissions']
  currentWeekKey: string
  selectedAttendanceWeekKey: string
  setSelectedAttendanceWeekKey: (weekKey: string) => void
  attendanceWeekDates: string[]
  attendanceWeekOptions: Array<{ weekKey: string; label: string }>
  weekTarget: { weekKey: string; targetSales: number; targetCpa: number; setAt: string } | null
  qaForm: { agentId: string; clientName: string; decision: string; callId: string; notes: string }
  setQaForm: React.Dispatch<
    React.SetStateAction<{ agentId: string; clientName: string; decision: string; callId: string; notes: string }>
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
  lastPoliciesBotRun: string | null
  onSetAttendancePercent: (agentId: string, dateKey: string, percent: AttendancePercent) => void
  onSetSpiffAmount: (agentId: string, dateKey: string, amount: number) => void
  onSubmitAttendanceDay: (dateKey: string) => void
  onAddAttendanceNote: (agentId: string, dateKey: string, note: string) => void
  onSaveWeeklyTarget: (sales: number, cpa: number) => void
  onQaSubmit: (e: React.FormEvent) => void
  onAuditSubmit: (e: React.FormEvent) => void
  onAuditNoActionSubmit: () => void
  onUpdateAuditRecord: (
    id: string,
    patch: Pick<AuditRecord, 'currentStatus' | 'resolutionTs' | 'notes'>,
  ) => void
  onDeleteAuditRecord: (id: string) => void
  weekTrend: { totalSales: number; currentCpa: number | null }
  house6pmSnapshotForToday: { dateKey: string; houseSales: number; houseCpa: number | null; capturedAt: string } | null
  eodReports: Array<{
    id: string
    weekKey: string
    dateKey: string
    houseSales: number
    houseCpa: number | null
    reportText: string
    submittedAt: string
  }>
  onSaveEodReport: (weekKey: string, reportText: string, houseSales: number, houseCpa: number | null) => void
}

export function TasksPage({
  taskPage,
  setTaskPage,
  todayKey,
  activeAgents,
  auditRecords,
  attendance,
  spiffRecords,
  attendanceSubmissions,
  currentWeekKey,
  selectedAttendanceWeekKey,
  setSelectedAttendanceWeekKey,
  attendanceWeekDates,
  attendanceWeekOptions,
  weekTarget,
  qaForm,
  setQaForm,
  auditForm,
  setAuditForm,
            incompleteQaAgentsToday,
            incompleteAuditAgentsToday,
            lastPoliciesBotRun,
            onSetAttendancePercent,
  onSetSpiffAmount,
  onSubmitAttendanceDay,
  onAddAttendanceNote,
  onSaveWeeklyTarget,
  onQaSubmit,
  onAuditSubmit,
  onAuditNoActionSubmit,
  onUpdateAuditRecord,
  onDeleteAuditRecord,
  weekTrend,
  house6pmSnapshotForToday,
  eodReports,
  onSaveEodReport,
}: Props) {
  const dayBasePay = 120
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null)
  const [eodReportText, setEodReportText] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [auditHistoryExpanded, setAuditHistoryExpanded] = useState(false)
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null)
  const [auditDraft, setAuditDraft] = useState<{
    currentStatus: string
    resolutionTs: string | null
    notes: string
  } | null>(null)
  const cancelAuditEdit = (): void => {
    setEditingAuditId(null)
    setAuditDraft(null)
  }
  const saveAuditEdit = (): void => {
    if (!editingAuditId || !auditDraft) return
    onUpdateAuditRecord(editingAuditId, {
      currentStatus: auditDraft.currentStatus,
      resolutionTs: auditDraft.resolutionTs,
      notes: auditDraft.notes,
    })
    cancelAuditEdit()
  }
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
  const agentAuditRows = useMemo(() => {
    if (!auditForm.agentId) return []
    const hideOnTasks = new Set(['no_action_needed', 'accepted', 'issued', 'placed'])
    return [...auditRecords]
      .filter(
        (r) =>
          r.agentId === auditForm.agentId && !hideOnTasks.has(r.currentStatus),
      )
      .sort((a, b) => (b.discoveryTs > a.discoveryTs ? 1 : -1))
  }, [auditRecords, auditForm.agentId])
  const displayAuditRows = auditHistoryExpanded ? agentAuditRows : agentAuditRows.slice(0, AUDIT_HISTORY_PREVIEW_ROWS)
  const formatCurrency = (amount: number): string => `$${amount.toFixed(2)}`
  const agentName = (agentId: string): string => activeAgents.find((a) => a.id === agentId)?.name ?? agentId
  const noteKeyFor = (agentId: string, dateKey: string): string => `${agentId}::${dateKey}`
  const renderMissingNames = (rows: Array<{ id: string; name: string }>) =>
    rows.map((agent, idx) => (
      <span key={agent.id}>
        <strong>{agent.name}</strong>
        {idx < rows.length - 1 ? ', ' : ''}
      </span>
    ))

  const taskItems = [
    { key: 'attendance' as const, label: 'Attendance' },
    { key: 'spiff' as const, label: 'Spiff' },
    { key: 'qa' as const, label: 'Daily QA' },
    { key: 'audit' as const, label: 'Action Needed Audit' },
    { key: 'targets' as const, label: 'Weekly Targets' },
    { key: 'eodReport' as const, label: 'EOD Report' },
  ]

  return (
    <div className="page-grid">
      <Card className="control-bar">
        <Tabs value={taskPage} onChange={setTaskPage} items={taskItems} />
      </Card>

      {taskPage === 'spiff' && (
        <Card className="space-y-4">
          <CardTitle>Spiff (Mon-Fri)</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <Field className="max-w-xs">
              <FieldLabel>Week</FieldLabel>
              <Select value={selectedAttendanceWeekKey} onChange={(e) => setSelectedAttendanceWeekKey(e.target.value)}>
                {attendanceWeekOptions.map((option) => (
                  <option key={option.weekKey} value={option.weekKey}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedAttendanceWeekKey === currentWeekKey}
              onClick={() => setSelectedAttendanceWeekKey(currentWeekKey)}
            >
              Current Week
            </Button>
          </div>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Agent</th>
                  {attendanceWeekDates.map((d) => (
                    <th key={d}>{formatDateKey(d)}</th>
                  ))}
                  <th>Week Spiff Total</th>
                </tr>
              </thead>
              <tbody>
                {activeAgents.length === 0 && (
                  <tr>
                    <td colSpan={attendanceWeekDates.length + 2}>N/A - no active agents.</td>
                  </tr>
                )}
                {activeAgents.map((agent) => {
                  const weekSpiffTotal = attendanceWeekDates.reduce((total, dateKey) => {
                    const row = spiffRecords.find((item) => item.agentId === agent.id && item.dateKey === dateKey)
                    return total + (row?.amount ?? 0)
                  }, 0)
                  return (
                    <tr key={agent.id}>
                      <td>{agent.name}</td>
                      {attendanceWeekDates.map((d) => {
                        const row = spiffRecords.find((item) => item.agentId === agent.id && item.dateKey === d)
                        return (
                          <td key={d}>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row?.amount ?? 0}
                              onChange={(e) => onSetSpiffAmount(agent.id, d, Number(e.target.value))}
                            />
                          </td>
                        )
                      })}
                      <td>{formatCurrency(weekSpiffTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          </TableWrap>
        </Card>
      )}

      {taskPage === 'attendance' && (
        <Card className="space-y-4">
          <CardTitle>Attendance (Mon-Fri)</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <Field className="max-w-xs">
              <FieldLabel>Week</FieldLabel>
              <Select value={selectedAttendanceWeekKey} onChange={(e) => setSelectedAttendanceWeekKey(e.target.value)}>
                {attendanceWeekOptions.map((option) => (
                  <option key={option.weekKey} value={option.weekKey}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedAttendanceWeekKey === currentWeekKey}
              onClick={() => setSelectedAttendanceWeekKey(currentWeekKey)}
            >
              Current Week
            </Button>
          </div>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Agent</th>
                  {attendanceWeekDates.map((d) => (
                    <th key={d}>{formatDateKey(d)}</th>
                  ))}
                  <th>Week Base Pay</th>
                </tr>
              </thead>
              <tbody>
                {activeAgents.length === 0 && (
                  <tr>
                    <td colSpan={attendanceWeekDates.length + 2}>N/A - no active agents.</td>
                  </tr>
                )}
                {activeAgents.map((agent) => {
                  const weekBasePay = attendanceWeekDates.reduce((total, dateKey) => {
                    const row = attendance.find((a) => a.agentId === agent.id && a.dateKey === dateKey)
                    const percent = row?.percent ?? 100
                    return total + (percent / 100) * dayBasePay
                  }, 0)
                  return (
                    <tr key={agent.id}>
                      <td>{agent.name}</td>
                      {attendanceWeekDates.map((d) => {
                        const row = attendance.find((a) => a.agentId === agent.id && a.dateKey === d)
                        const noteKey = noteKeyFor(agent.id, d)
                        const isEditing = editingNoteKey === noteKey
                        return (
                          <td key={d}>
                            <div className="space-y-1">
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
                              {isEditing ? (
                                <div className="space-y-1">
                                  <Textarea
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    placeholder="Attendance note"
                                    className="min-h-[64px] text-xs"
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="default"
                                      className="h-7 px-2 py-0 text-xs"
                                      disabled={!noteDraft.trim()}
                                      onClick={() => {
                                        onAddAttendanceNote(agent.id, d, noteDraft)
                                        setEditingNoteKey(null)
                                        setNoteDraft('')
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="h-7 px-2 py-0 text-xs"
                                      onClick={() => {
                                        setEditingNoteKey(null)
                                        setNoteDraft('')
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="h-7 px-2 py-0 text-xs"
                                  onClick={() => {
                                    setEditingNoteKey(noteKey)
                                    setNoteDraft(row?.notes ?? '')
                                  }}
                                >
                                  {row?.notes.trim() ? 'Edit Note' : 'Add Note'}
                                </Button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td>{formatCurrency(weekBasePay)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          </TableWrap>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Today ({formatDateKey(todayKey)})</p>
            <Button type="button" variant="default" className="mt-2 w-full sm:w-auto" onClick={() => onSubmitAttendanceDay(todayKey)}>
              Submit Day
            </Button>
            <p className="mt-2 text-xs text-slate-500">
              {(() => {
                const submission = attendanceSubmissions.find((item) => item.dateKey === todayKey)
                return submission ? `Submitted: ${formatTimestamp(submission.submittedAt)}` : 'Not submitted'
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
                onChange={(e) =>
                  setQaForm((prev) => ({
                    ...prev,
                    decision: e.target.value,
                    callId: e.target.value === 'Check Recording' ? prev.callId : '',
                  }))
                }
              >
                <option>Good Sale</option>
                <option>Check Recording</option>
              </Select>
            </Field>
            {qaForm.decision === 'Check Recording' ? (
              <Field>
                <FieldLabel>Call ID</FieldLabel>
                <Input
                  value={qaForm.callId}
                  onChange={(e) => setQaForm((prev) => ({ ...prev, callId: e.target.value }))}
                />
              </Field>
            ) : null}
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
            <p className="md:col-span-2 text-xs text-slate-500">
              Select an agent, then choose either Save Audit Entry (issue found) or Submit No Action Needed (no issue found).
            </p>
            <Button type="submit" variant="default" className="w-fit">
              Save Audit Entry
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              disabled={!auditForm.agentId}
              onClick={onAuditNoActionSubmit}
            >
              Submit No Action Needed
            </Button>
          </form>

          <div className="space-y-2">
            {!auditForm.agentId ? (
              <p className="text-sm text-slate-500">Select an agent to view their Action Needed history.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Action Needed History</h3>
                  {agentAuditRows.length > AUDIT_HISTORY_PREVIEW_ROWS && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setAuditHistoryExpanded((prev) => !prev)}
                    >
                      {auditHistoryExpanded ? 'Show less' : 'Show more'}
                    </Button>
                  )}
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
                        <th>Last parsed</th>
                        <th>Timestamp 2</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayAuditRows.length === 0 && (
                        <tr>
                          <td colSpan={9}>N/A</td>
                        </tr>
                      )}
                      {displayAuditRows.map((row) => {
                        const isRejectedOrWithdrawn =
                          row.currentStatus === 'rejected' || row.currentStatus === 'withdrawn'
                        const rowClass =
                          row.currentStatus === 'accepted'
                            ? '!bg-green-400/30'
                            : isRejectedOrWithdrawn
                              ? '!bg-red-400/30'
                              : undefined
                        return (
                        <tr key={row.id} className={rowClass}>
                          <td>{agentName(row.agentId)}</td>
                          <td>{formatTimestamp(row.discoveryTs)}</td>
                          <td>{row.carrier}</td>
                          <td>{row.clientName}</td>
                          <td>
                            <Select
                              value={
                                editingAuditId === row.id && auditDraft
                                  ? auditDraft.currentStatus
                                  : row.currentStatus
                              }
                              onChange={(e) => {
                                if (editingAuditId !== row.id) {
                                  setEditingAuditId(row.id)
                                  setAuditDraft({
                                    currentStatus: e.target.value,
                                    resolutionTs: row.resolutionTs,
                                    notes: row.notes ?? '',
                                  })
                                } else {
                                  setAuditDraft((prev) =>
                                    prev
                                      ? { ...prev, currentStatus: e.target.value }
                                      : {
                                          currentStatus: e.target.value,
                                          resolutionTs: row.resolutionTs,
                                          notes: row.notes ?? '',
                                        },
                                  )
                                }
                              }}
                            >
                              {POLICY_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td>{lastPoliciesBotRun ? formatLastParsedDate(lastPoliciesBotRun) : 'Never'}</td>
                          <td>
                            <Input
                              type="datetime-local"
                              value={toLocalDateTimeInput(
                                editingAuditId === row.id && auditDraft ? auditDraft.resolutionTs : row.resolutionTs,
                              )}
                              onChange={(e) => {
                                const nextIso = fromLocalDateTimeInput(e.target.value)
                                if (editingAuditId !== row.id) {
                                  setEditingAuditId(row.id)
                                  setAuditDraft({
                                    currentStatus: row.currentStatus,
                                    resolutionTs: nextIso,
                                    notes: row.notes ?? '',
                                  })
                                } else {
                                  setAuditDraft((prev) =>
                                    prev
                                      ? { ...prev, resolutionTs: nextIso }
                                      : {
                                          currentStatus: row.currentStatus,
                                          resolutionTs: nextIso,
                                          notes: row.notes ?? '',
                                        },
                                  )
                                }
                              }}
                            />
                          </td>
                          <td>
                            <Input
                              className="min-w-[140px]"
                              value={
                                editingAuditId === row.id && auditDraft
                                  ? auditDraft.notes
                                  : (row.notes ?? '')
                              }
                              onChange={(e) => {
                                if (editingAuditId !== row.id) {
                                  setEditingAuditId(row.id)
                                  setAuditDraft({
                                    currentStatus: row.currentStatus,
                                    resolutionTs: row.resolutionTs,
                                    notes: e.target.value,
                                  })
                                } else {
                                  setAuditDraft((prev) =>
                                    prev
                                      ? { ...prev, notes: e.target.value }
                                      : {
                                          currentStatus: row.currentStatus,
                                          resolutionTs: row.resolutionTs,
                                          notes: e.target.value,
                                        },
                                  )
                                }
                              }}
                              placeholder="Notes"
                            />
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              {editingAuditId === row.id ? (
                                <>
                                  <Button variant="default" onClick={saveAuditEdit}>
                                    Save
                                  </Button>
                                  <Button variant="secondary" onClick={cancelAuditEdit}>
                                    Cancel
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                variant="danger"
                                onClick={() => onDeleteAuditRecord(row.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </DataTable>
                </TableWrap>
                {agentAuditRows.length > AUDIT_HISTORY_PREVIEW_ROWS && !auditHistoryExpanded && (
                  <p className="text-sm text-slate-500">
                    Showing {AUDIT_HISTORY_PREVIEW_ROWS} of {agentAuditRows.length}. Click &quot;Show more&quot; for all rows.
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {taskPage === 'targets' && (
        <Card className="space-y-4">
          <CardTitle>Weekly Targets</CardTitle>
          <p className="text-sm text-slate-500">Set the current week sales and CPA goals here.</p>
          <WeeklyTargetEditor target={weekTarget} onSave={onSaveWeeklyTarget} />
        </Card>
      )}

      {taskPage === 'eodReport' && (
        <Card className="space-y-4">
          <CardTitle>EOD Report</CardTitle>
          <p className="text-sm text-slate-500">House metrics for the current week. Write your report and submit to save to vault history.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title={house6pmSnapshotForToday ? 'House Sales (6 PM)' : 'House Sales'}
              value={house6pmSnapshotForToday ? house6pmSnapshotForToday.houseSales : weekTrend.totalSales}
            />
            <MetricCard
              title={house6pmSnapshotForToday ? 'House CPA (6 PM)' : 'House CPA'}
              value={
                house6pmSnapshotForToday
                  ? house6pmSnapshotForToday.houseCpa === null
                    ? 'N/A'
                    : `$${formatNum(house6pmSnapshotForToday.houseCpa)}`
                  : weekTrend.currentCpa === null
                    ? 'N/A'
                    : `$${formatNum(weekTrend.currentCpa)}`
              }
            />
          </div>
          <Field>
            <FieldLabel>Report</FieldLabel>
            <Textarea
              value={eodReportText}
              onChange={(e) => setEodReportText(e.target.value)}
              placeholder="Enter your EOD report..."
              rows={6}
              className="w-full"
            />
          </Field>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              const sales = house6pmSnapshotForToday ? house6pmSnapshotForToday.houseSales : weekTrend.totalSales
              const cpa = house6pmSnapshotForToday ? house6pmSnapshotForToday.houseCpa : weekTrend.currentCpa
              onSaveEodReport(currentWeekKey, eodReportText, sales, cpa)
              setEodReportText('')
            }}
          >
            Submit & Save to Vault
          </Button>
          {eodReports.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-medium text-slate-700">EOD Report History (Vault)</h3>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
                {[...eodReports]
                  .sort((a, b) => (b.submittedAt > a.submittedAt ? 1 : -1))
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.id}>
                      {formatDateKey(r.dateKey)} — Sales: {r.houseSales}, CPA:{' '}
                      {r.houseCpa === null ? 'N/A' : `$${formatNum(r.houseCpa)}`}
                      {r.reportText.trim() ? ` — ${r.reportText.trim().slice(0, 60)}${r.reportText.trim().length > 60 ? '…' : ''}` : ''}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
