import { useMemo, useState } from 'react'
import React from 'react'
import { WeeklyTargetEditor } from '../components'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Tabs, Textarea } from '../components'
import { POLICY_STATUSES } from '../constants'
import type { QaFormState } from '../hooks'
import type { AuditRecord } from '../types'
import type { SpiffRecord, TaskPage, TransferRecord } from '../types'
import type { DataStore } from '../data'
import { formatDateKey, formatLastParsedDate, formatTimestamp, csvEscape } from '../utils'

const AUDIT_HISTORY_PREVIEW_ROWS = 5
const TRANSFER_HISTORY_PAGE_SIZE = 10

type Props = {
  taskPage: TaskPage
  setTaskPage: (p: TaskPage) => void
  activeAgents: DataStore['agents']
  auditRecords: AuditRecord[]
  spiffRecords: SpiffRecord[]
  currentWeekKey: string
  selectedAttendanceWeekKey: string
  setSelectedAttendanceWeekKey: (weekKey: string) => void
  attendanceWeekDates: string[]
  attendanceWeekOptions: Array<{ weekKey: string; label: string }>
  weekTarget: { weekKey: string; targetSales: number; targetCpa: number; setAt: string } | null
  qaForm: QaFormState
  setQaForm: React.Dispatch<React.SetStateAction<QaFormState>>
  auditForm: { agentId: string }
  setAuditForm: React.Dispatch<React.SetStateAction<{ agentId: string }>>
  incompleteQaAgentsForSelectedDate: Array<{ id: string; name: string }>
  todayKey: string
  incompleteAuditAgentsToday: Array<{ id: string; name: string }>
  lastPoliciesBotRun: string | null
  onSetSpiffAmount: (agentId: string, dateKey: string, amount: number) => void
  onSaveWeeklyTarget: (sales: number, cpa: number) => void
  onQaSubmit: (e: React.FormEvent) => void
  onAuditNoActionSubmit: () => void
  onUpdateAuditRecord: (
    id: string,
    patch: Pick<AuditRecord, 'currentStatus' | 'resolutionTs' | 'notes'>,
  ) => void
  onDeleteAuditRecord: (id: string) => void
  transfers: TransferRecord[]
  onAddTransfer: (transfer: Omit<TransferRecord, 'id'>) => void
  onDeleteTransfer: (id: string) => void
}

export function TasksPage({
  taskPage,
  setTaskPage,
  activeAgents,
  auditRecords,
  spiffRecords,
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
            incompleteQaAgentsForSelectedDate,
            todayKey,
            incompleteAuditAgentsToday,
            lastPoliciesBotRun,
  onSetSpiffAmount,
  onSaveWeeklyTarget,
  onQaSubmit,
  onAuditNoActionSubmit,
  onUpdateAuditRecord,
  onDeleteAuditRecord,
  transfers,
  onAddTransfer,
  onDeleteTransfer,
}: Props) {
  const [auditHistoryExpanded, setAuditHistoryExpanded] = useState(false)
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null)
  const [auditDraft, setAuditDraft] = useState<{
    currentStatus: string
    resolutionTs: string | null
    notes: string
  } | null>(null)
  const [transferForm, setTransferForm] = useState<{
    dateKey: string
    fromAgentId: string
    toAgentId: string
    clientName: string
  }>({
    dateKey: todayKey,
    fromAgentId: '',
    toAgentId: '',
    clientName: '',
  })
  const [showAllTransfers, setShowAllTransfers] = useState(false)
  const sortedTransfers = useMemo(
    () => [...transfers].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [transfers],
  )
  const displayTransfers = useMemo(
    () =>
      showAllTransfers ? sortedTransfers : sortedTransfers.slice(0, TRANSFER_HISTORY_PAGE_SIZE),
    [showAllTransfers, sortedTransfers],
  )
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

  const downloadAuditCsvForAgent = (
    agentDisplayName: string,
    rows: AuditRecord[],
    agentNameLookup: (id: string) => string,
    lastPoliciesBotRunValue: string | null,
    dateKey: string,
  ): void => {
    const lastParsedLabel = lastPoliciesBotRunValue ? formatLastParsedDate(lastPoliciesBotRunValue) : 'Never'
    const header =
      'Agent,Discovered,Carrier,Client,Status,Last parsed,Resolution Ts,Mgmt Notified,Outreach Made,Reason,Notes'
    const dataRows = rows.map((row) =>
      [
        agentNameLookup(row.agentId),
        formatTimestamp(row.discoveryTs),
        row.carrier,
        row.clientName,
        row.currentStatus,
        lastParsedLabel,
        row.resolutionTs ? formatTimestamp(row.resolutionTs) : '',
        row.mgmtNotified ? 'Yes' : 'No',
        row.outreachMade ? 'Yes' : 'No',
        row.reason,
        row.notes ?? '',
      ]
        .map(csvEscape)
        .join(','),
    )
    const csv = [header, ...dataRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = agentDisplayName.replace(/[^a-zA-Z0-9-_]/g, '_')
    a.download = `action_needed_audit_${safeName}_${dateKey}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderMissingNames = (rows: Array<{ id: string; name: string }>) =>
    rows.map((agent, idx) => (
      <span key={agent.id}>
        <strong>{agent.name}</strong>
        {idx < rows.length - 1 ? ', ' : ''}
      </span>
    ))

  const taskItems = [
    { key: 'spiff' as const, label: 'Spiff' },
    { key: 'qa' as const, label: 'Daily QA' },
    { key: 'audit' as const, label: 'Action Needed Audit' },
    // { key: 'transfers' as const, label: 'Transfers' }, // temporarily disabled
    { key: 'targets' as const, label: 'Weekly Targets' },
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

      {taskPage === 'qa' && (
        <Card className="space-y-4">
          <CardTitle>Daily QA Log</CardTitle>
          <div className="control-bar">
            <strong>Daily QA Completion</strong>
            {incompleteQaAgentsForSelectedDate.length > 0 ? (
              <p>
                Missing ({incompleteQaAgentsForSelectedDate.length}):{' '}
                {renderMissingNames(incompleteQaAgentsForSelectedDate)}
                {qaForm.dateKey !== todayKey ? ` for ${formatDateKey(qaForm.dateKey)}` : ''}
              </p>
            ) : (
              <p>
                All active agents have Daily QA completed
                {qaForm.dateKey === todayKey ? ' for today.' : ` for ${formatDateKey(qaForm.dateKey)}.`}
              </p>
            )}
          </div>
          <form onSubmit={onQaSubmit} className="form-grid">
            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={qaForm.dateKey}
                max={todayKey}
                onChange={(e) => setQaForm((prev) => ({ ...prev, dateKey: e.target.value }))}
              />
            </Field>
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
                    decision: e.target.value as QaFormState['decision'],
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
          <div className="flex flex-wrap items-end gap-2">
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
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              disabled={!auditForm.agentId}
              onClick={onAuditNoActionSubmit}
            >
              Submit No Action Needed
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              disabled={!auditForm.agentId}
              onClick={() =>
                downloadAuditCsvForAgent(
                  agentName(auditForm.agentId),
                  agentAuditRows,
                  agentName,
                  lastPoliciesBotRun,
                  todayKey,
                )
              }
            >
              Download CSV
            </Button>
          </div>

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
                        const isRedStatus =
                          row.currentStatus === 'rejected' ||
                          row.currentStatus === 'withdrawn' ||
                          row.currentStatus === 'future_cancellation' ||
                          row.currentStatus === 'old_policy_terminated' ||
                          row.currentStatus === 'cancelled'
                        const isFlagged = row.currentStatus === 'flagged'
                        const rowClass =
                          row.currentStatus === 'accepted'
                            ? '!bg-green-400/30'
                            : isRedStatus
                              ? '!bg-red-400/30'
                              : isFlagged
                                ? '!bg-yellow-400/30'
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

      {/* Transfers temporarily disabled */}
      {false && taskPage === 'transfers' && (
        <Card className="space-y-4">
          <CardTitle>Transfers</CardTitle>
          <p className="text-sm text-slate-500">
            Track internal transfers between agents. These records are used to compute transfer-adjusted CPA on the Metrics page.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              if (
                !transferForm.fromAgentId ||
                !transferForm.toAgentId ||
                !transferForm.dateKey ||
                !transferForm.clientName.trim()
              )
                return
              onAddTransfer({
                dateKey: transferForm.dateKey,
                fromAgentId: transferForm.fromAgentId,
                toAgentId: transferForm.toAgentId,
                successClosed: true,
              })
              setTransferForm((prev) => ({
                ...prev,
                dateKey: todayKey,
                fromAgentId: '',
                toAgentId: '',
                clientName: '',
              }))
            }}
          >
            <Field>
              <FieldLabel>Agent who sent transfer</FieldLabel>
              <Select
                value={transferForm.fromAgentId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, fromAgentId: e.target.value }))}
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
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={transferForm.dateKey}
                max={todayKey}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, dateKey: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>Client name</FieldLabel>
              <Input
                value={transferForm.clientName}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, clientName: e.target.value }))}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Agent who received transfer</FieldLabel>
              <Select
                value={transferForm.toAgentId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, toAgentId: e.target.value }))}
              >
                <option value="">Select agent</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="submit"
              variant="default"
              className="w-fit"
              disabled={
                !transferForm.fromAgentId ||
                !transferForm.toAgentId ||
                !transferForm.dateKey ||
                !transferForm.clientName.trim()
              }
            >
              Add transfer
            </Button>
          </form>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Transfer History</h3>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortedTransfers.length === 0 && (
                    <tr>
                      <td colSpan={4}>N/A</td>
                    </tr>
                  )}
                  {displayTransfers.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateKey(row.dateKey)}</td>
                      <td>{agentName(row.fromAgentId)}</td>
                      <td>{agentName(row.toAgentId)}</td>
                      <td className="text-right">
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => onDeleteTransfer(row.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            {sortedTransfers.length > TRANSFER_HISTORY_PAGE_SIZE && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-sm text-slate-600"
                  onClick={() => setShowAllTransfers((v) => !v)}
                >
                  {showAllTransfers
                    ? 'Show less'
                    : `Show more (${sortedTransfers.length - TRANSFER_HISTORY_PAGE_SIZE} more)`}
                </Button>
              </div>
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

    </div>
  )
}
