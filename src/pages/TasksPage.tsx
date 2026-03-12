import { useMemo, useState } from 'react'
import React from 'react'
import { WeeklyTargetEditor } from '../components'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, MetricCard, Select, TableWrap, Tabs, Textarea } from '../components'
import { POLICY_STATUSES } from '../constants'
import type { AuditRecord } from '../types'
import type { PerfHistory, SpiffRecord, TaskPage } from '../types'
import type { DataStore } from '../data'
import { formatDateKey, formatLastParsedDate, formatNum, formatTimestamp, csvEscape, uid } from '../utils'

const AUDIT_HISTORY_PREVIEW_ROWS = 5
const CPA_HIGHLIGHT_THRESHOLD = 130

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
  qaForm: { dateKey: string; agentId: string; clientName: string; decision: string; callId: string; notes: string }
  setQaForm: React.Dispatch<
    React.SetStateAction<{
      dateKey: string
      agentId: string
      clientName: string
      decision: string
      callId: string
      notes: string
    }>
  >
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
  eodTodayTotals: { sales: number; marketing: number; cpa: number | null }
  eodHistoryDays: Array<{
    dateKey: string
    houseSales: number
    houseCpa: number | null
    reportText?: string
    submittedAt?: string
    agentRows: Array<{
      agentId: string
      agentName: string
      calls: number
      sales: number
      marketing: number
      cpa: number | null
      cvr: number | null
    }>
  }>
  onSaveEodReport: (weekKey: string, reportText: string, houseSales: number, houseCpa: number | null) => void
  setPerfHistory: React.Dispatch<React.SetStateAction<PerfHistory[]>>
  agentPerformanceRows: Array<{
    agentId: string
    agentName: string
    calls: number
    sales: number
    marketing: number
    cpa: number | null
    cvr: number | null
  }>
  lastSnapshotLabel: string
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
  eodTodayTotals,
  eodHistoryDays,
  onSaveEodReport,
  setPerfHistory,
  agentPerformanceRows,
  lastSnapshotLabel,
}: Props) {
  const [eodReportText, setEodReportText] = useState('')
  const [eodAgentSortBy, setEodAgentSortBy] = useState<'cpa' | 'sales'>('cpa')
  const [eodAgentSortDir, setEodAgentSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedEodDateKey, setExpandedEodDateKey] = useState<string | null>(null)
  const [showAddPastDayForm, setShowAddPastDayForm] = useState(false)
  const [addPastDayDateKey, setAddPastDayDateKey] = useState('')
  const [addPastDayRows, setAddPastDayRows] = useState<Record<string, { calls: string; sales: string; marketing: string }>>({})
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

  const eodDisplayedAgentRows = useMemo(() => {
    const rows = [...agentPerformanceRows]
    if (eodAgentSortBy === 'cpa') {
      rows.sort((a, b) => {
        const va = a.cpa ?? -Infinity
        const vb = b.cpa ?? -Infinity
        return eodAgentSortDir === 'desc' ? vb - va : va - vb
      })
    } else {
      rows.sort((a, b) => (eodAgentSortDir === 'desc' ? b.sales - a.sales : a.sales - b.sales))
    }
    return rows
  }, [agentPerformanceRows, eodAgentSortBy, eodAgentSortDir])
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
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-1 space-y-2">
              <h3 className="text-sm font-medium text-slate-700">Agent Performance</h3>
              <p className="text-xs text-slate-500">Data: {lastSnapshotLabel}</p>
              {agentPerformanceRows.length === 0 ? (
                <p className="text-sm text-slate-500">No active agents.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      Sort by
                      <select
                        value={eodAgentSortBy}
                        onChange={(e) => setEodAgentSortBy(e.target.value as 'cpa' | 'sales')}
                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="cpa">CPA</option>
                        <option value="sales">Sales</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      Order
                      <select
                        value={eodAgentSortDir}
                        onChange={(e) => setEodAgentSortDir(e.target.value as 'asc' | 'desc')}
                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="desc">Descending (high first)</option>
                        <option value="asc">Ascending (low first)</option>
                      </select>
                    </label>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-[500px] rounded border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                        <tr className="border-b border-slate-200">
                          <th className="pb-2 pt-2 pr-4 font-medium text-slate-700">Agent</th>
                          <th className="pb-2 pt-2 pr-4 text-right font-medium text-slate-700">CPA</th>
                          <th className="pb-2 pt-2 pr-4 text-right font-medium text-slate-700">Sales</th>
                          <th className="pb-2 pt-2 pr-4 text-right font-medium text-slate-700">Calls</th>
                          <th className="pb-2 pt-2 pr-4 text-right font-medium text-slate-700">Marketing</th>
                          <th className="pb-2 pt-2 text-right font-medium text-slate-700">CVR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eodDisplayedAgentRows.map((row) => {
                          const cpaOverThreshold = row.cpa !== null && row.cpa > CPA_HIGHLIGHT_THRESHOLD
                          return (
                            <tr
                              key={row.agentId}
                              className={`border-b border-slate-100 ${cpaOverThreshold ? 'bg-red-500/10' : ''}`}
                            >
                              <td className="py-2 pr-4 font-medium">{row.agentName}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">
                                {row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums">{row.sales}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{row.calls}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                              <td className="py-2 text-right tabular-nums">
                                {row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-5 xl:col-span-2">
              <p className="text-sm text-slate-500">House metrics for today (EOD). Write your report and submit to save to vault history.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  title="House Sales"
                  value={eodTodayTotals.sales}
                />
                <MetricCard
                  title="House CPA"
                  value={
                    eodTodayTotals.cpa === null
                      ? 'N/A'
                      : `$${formatNum(eodTodayTotals.cpa)}`
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
                  onSaveEodReport(currentWeekKey, eodReportText, eodTodayTotals.sales, eodTodayTotals.cpa)
                  setEodReportText('')
                }}
              >
                Submit & Save to Vault
              </Button>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-slate-700">EOD Report History (Vault)</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddPastDayForm((v) => !v)
                      if (!showAddPastDayForm) {
                        setAddPastDayDateKey('')
                        setAddPastDayRows(
                          Object.fromEntries(
                            activeAgents.map((a) => [a.id, { calls: '', sales: '', marketing: '' }])
                          )
                        )
                      }
                    }}
                  >
                    {showAddPastDayForm ? 'Cancel' : 'Add performance for past day'}
                  </Button>
                </div>
                {showAddPastDayForm && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <Field>
                      <FieldLabel>Date</FieldLabel>
                      <Input
                        type="date"
                        value={addPastDayDateKey}
                        onChange={(e) => setAddPastDayDateKey(e.target.value)}
                        className="w-full max-w-xs"
                      />
                    </Field>
                    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="p-2 font-medium text-slate-700">Agent</th>
                            <th className="p-2 font-medium text-slate-700">Calls</th>
                            <th className="p-2 font-medium text-slate-700">Sales</th>
                            <th className="p-2 font-medium text-slate-700">Marketing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeAgents.map((agent) => {
                            const row = addPastDayRows[agent.id] ?? { calls: '', sales: '', marketing: '' }
                            return (
                              <tr key={agent.id} className="border-b border-slate-100">
                                <td className="p-2 font-medium">{agent.name}</td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={row.calls}
                                    onChange={(e) =>
                                      setAddPastDayRows((prev) => ({
                                        ...prev,
                                        [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), calls: e.target.value },
                                      }))
                                    }
                                    placeholder="0"
                                    className="w-20"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={row.sales}
                                    onChange={(e) =>
                                      setAddPastDayRows((prev) => ({
                                        ...prev,
                                        [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), sales: e.target.value },
                                      }))
                                    }
                                    placeholder="0"
                                    className="w-20"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={row.marketing}
                                    onChange={(e) =>
                                      setAddPastDayRows((prev) => ({
                                        ...prev,
                                        [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), marketing: e.target.value },
                                      }))
                                    }
                                    placeholder="0"
                                    className="w-24"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => {
                          if (!addPastDayDateKey.trim()) return
                          const newRows: PerfHistory[] = []
                          for (const agent of activeAgents) {
                            const row = addPastDayRows[agent.id]
                            if (!row) continue
                            const calls = Math.max(0, Math.floor(Number(row.calls) || 0))
                            const sales = Math.max(0, Number(row.sales) || 0)
                            const marketing = Math.max(0, Number(row.marketing) || 0)
                            if (calls === 0 && sales === 0 && marketing === 0) continue
                            const cpa = sales > 0 ? marketing / sales : null
                            const cvr = calls > 0 ? sales / calls : null
                            newRows.push({
                              id: uid('perf'),
                              dateKey: addPastDayDateKey,
                              agentId: agent.id,
                              billableCalls: calls,
                              sales,
                              marketing,
                              cpa,
                              cvr,
                              frozenAt: new Date().toISOString(),
                            })
                          }
                          if (newRows.length === 0) return
                          setPerfHistory((prev) => [...prev, ...newRows])
                          setShowAddPastDayForm(false)
                          setAddPastDayDateKey('')
                          setAddPastDayRows({})
                        }}
                      >
                        Save
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setShowAddPastDayForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {eodHistoryDays.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-100">
                          <tr className="border-b border-slate-200">
                            <th className="p-2 font-medium text-slate-700">Date</th>
                            <th className="p-2 font-medium text-slate-700 text-right">Sales</th>
                            <th className="p-2 font-medium text-slate-700 text-right">CPA</th>
                            <th className="p-2 font-medium text-slate-700">Preview</th>
                            <th className="p-2 w-24" aria-label="Open" />
                          </tr>
                        </thead>
                        <tbody>
                          {eodHistoryDays.map((day) => (
                            <tr
                              key={day.dateKey}
                              className="border-b border-slate-200 cursor-pointer hover:bg-slate-100/80"
                              onClick={() => setExpandedEodDateKey(day.dateKey)}
                            >
                              <td className="p-2 font-medium">{formatDateKey(day.dateKey)}</td>
                              <td className="p-2 text-right tabular-nums">{day.houseSales}</td>
                              <td className="p-2 text-right tabular-nums">
                                {day.houseCpa === null ? 'N/A' : `$${formatNum(day.houseCpa)}`}
                              </td>
                              <td className="p-2 text-slate-600 truncate max-w-[200px]">
                                {day.reportText ? `${day.reportText.slice(0, 50)}${day.reportText.length > 50 ? '…' : ''}` : '—'}
                              </td>
                              <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => setExpandedEodDateKey(day.dateKey)}
                                >
                                  Open
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No EOD history yet. Submit a report or add performance for a past day.</p>
                )}
                {expandedEodDateKey && (() => {
                  const day = eodHistoryDays.find((d) => d.dateKey === expandedEodDateKey)
                  if (!day) return null
                  return (
                    <div
                      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="eod-detail-title"
                      onClick={() => setExpandedEodDateKey(null)}
                    >
                      <Card
                        className="my-4 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CardTitle id="eod-detail-title" className="border-b border-slate-200 pb-3">
                          EOD Report — {formatDateKey(day.dateKey)}
                        </CardTitle>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2 max-w-md">
                            <MetricCard title="House Sales" value={day.houseSales} />
                            <MetricCard
                              title="House CPA"
                              value={day.houseCpa === null ? 'N/A' : `$${formatNum(day.houseCpa)}`}
                            />
                          </div>
                          {day.reportText ? (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Report</p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{day.reportText}</p>
                            </div>
                          ) : null}
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Agent performance</p>
                            {day.agentRows.length === 0 ? (
                              <p className="text-sm text-slate-500">No performance data for this day.</p>
                            ) : (
                              <div className="overflow-x-auto rounded border border-slate-200">
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                      <th className="p-2 font-medium text-slate-700">Agent</th>
                                      <th className="p-2 font-medium text-slate-700 text-right">CPA</th>
                                      <th className="p-2 font-medium text-slate-700 text-right">Sales</th>
                                      <th className="p-2 font-medium text-slate-700 text-right">Calls</th>
                                      <th className="p-2 font-medium text-slate-700 text-right">Marketing</th>
                                      <th className="p-2 font-medium text-slate-700 text-right">CVR</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.agentRows.map((row) => {
                                      const cpaOverThreshold = row.cpa !== null && row.cpa > CPA_HIGHLIGHT_THRESHOLD
                                      return (
                                        <tr
                                          key={row.agentId}
                                          className={`border-b border-slate-100 ${cpaOverThreshold ? 'bg-red-500/10' : ''}`}
                                        >
                                          <td className="p-2 font-medium">{row.agentName}</td>
                                          <td className="p-2 text-right tabular-nums">
                                            {row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}
                                          </td>
                                          <td className="p-2 text-right tabular-nums">{row.sales}</td>
                                          <td className="p-2 text-right tabular-nums">{row.calls}</td>
                                          <td className="p-2 text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                                          <td className="p-2 text-right tabular-nums">
                                            {row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-slate-200 p-4 bg-slate-50">
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => setExpandedEodDateKey(null)}
                          >
                            Close
                          </Button>
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
