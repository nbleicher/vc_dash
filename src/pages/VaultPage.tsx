import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DataStore } from '../data'
import { Badge, Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap } from '../components'
import { POLICY_STATUSES } from '../constants'

const AUDIT_STATUS_OPTIONS = [...POLICY_STATUSES, 'no_action_needed']
import type { AuditRecord, QaRecord, RankMetric, VaultScope } from '../types'
import { formatDateKey, formatLastParsedDate, formatNum, formatTimestamp } from '../utils'

type Props = {
  vaultScope: VaultScope
  setVaultScope: (s: VaultScope) => void
  historySort: 'newest' | 'oldest'
  setHistorySort: (s: 'newest' | 'oldest') => void
  agents: DataStore['agents']
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
  rankRows: Array<{ agentId: string; agentName: string; sales: number; cpa: number | null; cvr: number | null }>
  rankRowsTransferAdjusted: Array<{ agentId: string; agentName: string; sales: number; cpa: number | null; cvr: number | null }>
  rankMetric: RankMetric
  setRankMetric: (m: RankMetric) => void
}

const PAGE_SIZE = 50
const QUICK_VIEW_ROWS = 5

export function VaultPage({
  vaultScope,
  setVaultScope,
  historySort,
  setHistorySort,
  agents,
  vaultQaHistory,
  vaultAuditHistory,
  lastPoliciesBotRun,
  onUpdateQaRecord,
  onUpdateAuditRecord,
  onDeleteAuditRecord,
  rankRows,
  rankRowsTransferAdjusted,
  rankMetric,
  setRankMetric,
}: Props) {
  const [fullTableMode, setFullTableMode] = useState<'qa' | 'audit' | null>(null)
  const [popupSearch, setPopupSearch] = useState('')
  const [popupPage, setPopupPage] = useState(1)
  const [editingQaId, setEditingQaId] = useState<string | null>(null)
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null)
  const [qaDraft, setQaDraft] = useState<Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'> | null>(
    null,
  )
  const [auditDraft, setAuditDraft] = useState<
    Pick<AuditRecord, 'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'> | null
  >(null)
  const [editError, setEditError] = useState<string | null>(null)
  useEffect(() => {
    if (vaultScope !== 'house') setVaultScope('house')
  }, [vaultScope, setVaultScope])

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

  const canEditHistory = true

  const toLocalDateTimeInput = (iso: string | null): string => {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (value: number) => String(value).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const hh = pad(date.getHours())
    const mm = pad(date.getMinutes())
    return `${y}-${m}-${d}T${hh}:${mm}`
  }

  const fromLocalDateTimeInput = (value: string): string | null => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
  }

  const startQaEdit = (row: Props['vaultQaHistory'][number]): void => {
    setEditingQaId(row.id)
    setQaDraft({
      agentId: row.agentId,
      dateKey: row.dateKey,
      clientName: row.clientName,
      decision: row.decision as QaRecord['decision'],
      status: row.status as QaRecord['status'],
      notes: row.notes,
    })
    setEditError(null)
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

  const renderQaHistoryCard = (rows: Props['vaultQaHistory'], showFullAction = false, allowEdit = false) => {
    const tableRows = showFullAction ? rows.slice(0, QUICK_VIEW_ROWS) : rows
    return (
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
              {allowEdit ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={allowEdit ? 7 : 6}>N/A</td>
              </tr>
            )}
            {tableRows.map((row) => (
              <tr key={row.id}>
                <td>
                  {allowEdit && editingQaId === row.id && qaDraft ? (
                    <Select
                      value={qaDraft.agentId}
                      onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, agentId: e.target.value } : prev))}
                    >
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    agentName(row.agentId)
                  )}
                </td>
                <td>
                  {allowEdit && editingQaId === row.id && qaDraft ? (
                    <Input
                      type="date"
                      value={qaDraft.dateKey}
                      onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, dateKey: e.target.value } : prev))}
                    />
                  ) : (
                    formatDateKey(row.dateKey)
                  )}
                </td>
                <td>
                  {allowEdit && editingQaId === row.id && qaDraft ? (
                    <Input
                      value={qaDraft.clientName}
                      onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, clientName: e.target.value } : prev))}
                    />
                  ) : (
                    row.clientName
                  )}
                </td>
                <td>
                  {allowEdit && editingQaId === row.id && qaDraft ? (
                    <Select
                      value={qaDraft.decision}
                      onChange={(e) =>
                        setQaDraft((prev) => (prev ? { ...prev, decision: e.target.value as QaRecord['decision'] } : prev))
                      }
                    >
                      <option value="Good Sale">Good Sale</option>
                      <option value="Check Recording">Check Recording</option>
                    </Select>
                  ) : (
                    row.decision
                  )}
                </td>
                <td>
                  {allowEdit && editingQaId === row.id && qaDraft ? (
                    <Select
                      value={qaDraft.status}
                      onChange={(e) =>
                        setQaDraft((prev) => (prev ? { ...prev, status: e.target.value as QaRecord['status'] } : prev))
                      }
                    >
                      <option value="Good">Good</option>
                      <option value="Check Recording">Check Recording</option>
                      <option value="Resolved">Resolved</option>
                    </Select>
                  ) : (
                    row.status
                  )}
                </td>
                <td>
                  {allowEdit && editingQaId === row.id && qaDraft ? (
                    <Input
                      value={qaDraft.notes}
                      onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                    />
                  ) : (
                    row.notes || 'N/A'
                  )}
                </td>
                {allowEdit ? (
                  <td>
                    {editingQaId === row.id ? (
                      <div className="flex gap-2">
                        <Button variant="default" onClick={saveQaEdit}>
                          Save
                        </Button>
                        <Button variant="secondary" onClick={cancelQaEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => startQaEdit(row)}
                        disabled={!!editingAuditId || (editingQaId !== null && editingQaId !== row.id)}
                      >
                        Edit
                      </Button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrap>
      {showFullAction && rows.length > QUICK_VIEW_ROWS ? (
        <p className="mt-2 text-sm text-slate-500">
          Showing {QUICK_VIEW_ROWS} of {rows.length}. Click "View Full Table" for all rows.
        </p>
      ) : null}
    </Card>
    )
  }

  const renderAuditHistoryCard = (rows: Props['vaultAuditHistory'], showFullAction = false, allowEdit = false) => {
    const tableRows = showFullAction ? rows.slice(0, QUICK_VIEW_ROWS) : rows
    return (
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
              <th>Last parsed</th>
              <th>Timestamp 2</th>
              <th>Notes</th>
              {allowEdit ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={allowEdit ? 9 : 8}>N/A</td>
              </tr>
            )}
            {tableRows.map((row) => {
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
                  {allowEdit ? (
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
                            ...row,
                            currentStatus: e.target.value,
                            notes: (row as AuditRecord).notes ?? '',
                          })
                        } else {
                          setAuditDraft((prev) =>
                            prev
                              ? { ...prev, currentStatus: e.target.value }
                              : { ...row, currentStatus: e.target.value, notes: (row as AuditRecord).notes ?? '' },
                          )
                        }
                        setEditError(null)
                      }}
                    >
                      {AUDIT_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <>
                      {row.currentStatus === 'no_action_needed' ? (
                        <Badge variant="success">No Action Needed</Badge>
                      ) : (
                        <Badge variant="warning">Needs Review</Badge>
                      )}
                    </>
                  )}
                </td>
                <td>{lastPoliciesBotRun ? formatLastParsedDate(lastPoliciesBotRun) : 'Never'}</td>
                <td>
                  {allowEdit ? (
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
                            ...row,
                            resolutionTs: nextIso,
                            notes: (row as AuditRecord).notes ?? '',
                          })
                        } else {
                          setAuditDraft((prev) =>
                            prev
                              ? { ...prev, resolutionTs: nextIso }
                              : { ...row, resolutionTs: nextIso, notes: (row as AuditRecord).notes ?? '' },
                          )
                        }
                        setEditError(null)
                      }}
                    />
                  ) : (
                    formatTimestamp(row.resolutionTs)
                  )}
                </td>
                <td>
                  {allowEdit ? (
                    <Input
                      className="min-w-[140px]"
                      value={
                        editingAuditId === row.id && auditDraft ? auditDraft.notes ?? '' : (row as AuditRecord).notes ?? ''
                      }
                      onChange={(e) => {
                        if (editingAuditId !== row.id) {
                          setEditingAuditId(row.id)
                          setAuditDraft({ ...row, notes: e.target.value })
                        } else {
                          setAuditDraft((prev) =>
                            prev ? { ...prev, notes: e.target.value } : { ...row, notes: e.target.value },
                          )
                        }
                        setEditError(null)
                      }}
                      placeholder="Notes"
                    />
                  ) : (
                    ((row as AuditRecord).notes ?? '') || '—'
                  )}
                </td>
                {allowEdit ? (
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
                      <Button variant="danger" onClick={() => onDeleteAuditRecord(row.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            )})}
          </tbody>
        </DataTable>
      </TableWrap>
      {showFullAction && rows.length > QUICK_VIEW_ROWS ? (
        <p className="mt-2 text-sm text-slate-500">
          Showing {QUICK_VIEW_ROWS} of {rows.length}. Click "View Full Table" for all rows.
        </p>
      ) : null}
    </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <CardTitle>Vault</CardTitle>
      <div className="row-wrap control-bar">
        <Field className="w-full min-w-0 sm:min-w-[180px]">
          <FieldLabel>Sort</FieldLabel>
          <Select value={historySort} onChange={(e) => setHistorySort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </Field>
      </div>
      {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
      <>
        <div className="split">
          {renderQaHistoryCard(vaultQaHistory, true, canEditHistory)}
          {renderAuditHistoryCard(vaultAuditHistory, true, canEditHistory)}
        </div>
      </>

      <Card className="space-y-4">
        <CardTitle>Agent Ranking</CardTitle>
        <div className="row-wrap control-bar">
          <Field className="w-full min-w-0 sm:min-w-[180px]">
            <FieldLabel>Metric</FieldLabel>
            <Select value={rankMetric} onChange={(e) => setRankMetric(e.target.value as RankMetric)}>
              <option>Sales</option>
              <option>CPA</option>
              <option>CVR</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Standard</h3>
            <TableWrap>
              <DataTable className="mx-auto w-full min-w-0 max-w-[900px] sm:min-w-[640px]">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1 text-left">Rank</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-left">Agent</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">Sales</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">CPA</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">CVR</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(even)]:bg-transparent">
                  {rankRows.length === 0 && (
                    <tr>
                      <td colSpan={5}>N/A</td>
                    </tr>
                  )}
                  {rankRows.map((row, idx) => (
                    <tr key={row.agentId}>
                      <td className="px-2 py-1">{idx + 1}</td>
                      <td className="px-2 py-1">{row.agentName}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.sales}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Agent Ranking (transfer adjusted)</h3>
            <TableWrap>
              <DataTable className="mx-auto w-full min-w-0 max-w-[900px] sm:min-w-[640px]">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1 text-left">Rank</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-left">Agent</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">Sales</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">CPA</th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">CVR</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(even)]:bg-transparent">
                  {rankRowsTransferAdjusted.length === 0 && (
                    <tr>
                      <td colSpan={5}>N/A</td>
                    </tr>
                  )}
                  {rankRowsTransferAdjusted.map((row, idx) => (
                    <tr key={row.agentId}>
                      <td className="px-2 py-1">{idx + 1}</td>
                      <td className="px-2 py-1">{row.agentName}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.sales}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </div>
        </div>
      </Card>

      {fullTableMode && (
        <div className="mobile-modal-scroll fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 sm:items-center">
          <Card className="max-h-[90dvh] w-full min-w-0 max-w-[calc(100vw-2rem)] sm:max-w-7xl overflow-hidden">
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
              <Field className="w-full min-w-0 sm:min-w-[320px]">
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
            <TableWrap className="max-h-[56dvh] sm:max-h-[58vh]">
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
                      {canEditHistory ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {qaPagedRows.length === 0 && (
                      <tr>
                        <td colSpan={canEditHistory ? 7 : 6}>No QA rows match this search.</td>
                      </tr>
                    )}
                    {qaPagedRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {canEditHistory && editingQaId === row.id && qaDraft ? (
                            <Select
                              value={qaDraft.agentId}
                              onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, agentId: e.target.value } : prev))}
                            >
                              {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            agentName(row.agentId)
                          )}
                        </td>
                        <td>
                          {canEditHistory && editingQaId === row.id && qaDraft ? (
                            <Input
                              type="date"
                              value={qaDraft.dateKey}
                              onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, dateKey: e.target.value } : prev))}
                            />
                          ) : (
                            formatDateKey(row.dateKey)
                          )}
                        </td>
                        <td>
                          {canEditHistory && editingQaId === row.id && qaDraft ? (
                            <Input
                              value={qaDraft.clientName}
                              onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, clientName: e.target.value } : prev))}
                            />
                          ) : (
                            row.clientName
                          )}
                        </td>
                        <td>
                          {canEditHistory && editingQaId === row.id && qaDraft ? (
                            <Select
                              value={qaDraft.decision}
                              onChange={(e) =>
                                setQaDraft((prev) => (prev ? { ...prev, decision: e.target.value as QaRecord['decision'] } : prev))
                              }
                            >
                              <option value="Good Sale">Good Sale</option>
                              <option value="Check Recording">Check Recording</option>
                            </Select>
                          ) : (
                            row.decision
                          )}
                        </td>
                        <td>
                          {canEditHistory && editingQaId === row.id && qaDraft ? (
                            <Select
                              value={qaDraft.status}
                              onChange={(e) =>
                                setQaDraft((prev) => (prev ? { ...prev, status: e.target.value as QaRecord['status'] } : prev))
                              }
                            >
                              <option value="Good">Good</option>
                              <option value="Check Recording">Check Recording</option>
                              <option value="Resolved">Resolved</option>
                            </Select>
                          ) : (
                            row.status
                          )}
                        </td>
                        <td>
                          {canEditHistory && editingQaId === row.id && qaDraft ? (
                            <Input
                              value={qaDraft.notes}
                              onChange={(e) => setQaDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                            />
                          ) : (
                            row.notes || 'N/A'
                          )}
                        </td>
                        {canEditHistory ? (
                          <td>
                            {editingQaId === row.id ? (
                              <div className="flex gap-2">
                                <Button variant="default" onClick={saveQaEdit}>
                                  Save
                                </Button>
                                <Button variant="secondary" onClick={cancelQaEdit}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                onClick={() => startQaEdit(row)}
                                disabled={!!editingAuditId || (editingQaId !== null && editingQaId !== row.id)}
                              >
                                Edit
                              </Button>
                            )}
                          </td>
                        ) : null}
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
                      <th>Last parsed</th>
                      <th>Timestamp 1</th>
                      <th>Timestamp 2</th>
                      <th>Notes</th>
                      {canEditHistory ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {auditPagedRows.length === 0 && (
                      <tr>
                        <td colSpan={canEditHistory ? 10 : 9}>No audit rows match this search.</td>
                      </tr>
                    )}
                    {auditPagedRows.map((row) => {
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
                          {canEditHistory ? (
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
                                    ...row,
                                    currentStatus: e.target.value,
                                    notes: (row as AuditRecord).notes ?? '',
                                  })
                                } else {
                                  setAuditDraft((prev) =>
                                    prev
                                      ? { ...prev, currentStatus: e.target.value }
                                      : { ...row, currentStatus: e.target.value, notes: (row as AuditRecord).notes ?? '' },
                                  )
                                }
                                setEditError(null)
                              }}
                            >
                              {AUDIT_STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <>
                              {row.currentStatus === 'no_action_needed' ? (
                                <Badge variant="success">No Action Needed</Badge>
                              ) : (
                                <Badge variant="warning">Needs Review</Badge>
                              )}
                            </>
                          )}
                        </td>
                        <td>{lastPoliciesBotRun ? formatLastParsedDate(lastPoliciesBotRun) : 'Never'}</td>
                        <td>{formatTimestamp(row.discoveryTs)}</td>
                        <td>
                          {canEditHistory ? (
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
                                    ...row,
                                    resolutionTs: nextIso,
                                    notes: (row as AuditRecord).notes ?? '',
                                  })
                                } else {
                                  setAuditDraft((prev) =>
                                    prev
                                      ? { ...prev, resolutionTs: nextIso }
                                      : { ...row, resolutionTs: nextIso, notes: (row as AuditRecord).notes ?? '' },
                                  )
                                }
                                setEditError(null)
                              }}
                            />
                          ) : (
                            formatTimestamp(row.resolutionTs)
                          )}
                        </td>
                        <td>
                          {canEditHistory ? (
                            <Input
                              className="min-w-[140px]"
                              value={
                                editingAuditId === row.id && auditDraft ? auditDraft.notes ?? '' : (row as AuditRecord).notes ?? ''
                              }
                              onChange={(e) => {
                                if (editingAuditId !== row.id) {
                                  setEditingAuditId(row.id)
                                  setAuditDraft({ ...row, notes: e.target.value })
                                } else {
                                  setAuditDraft((prev) =>
                                    prev ? { ...prev, notes: e.target.value } : { ...row, notes: e.target.value },
                                  )
                                }
                                setEditError(null)
                              }}
                              placeholder="Notes"
                            />
                          ) : (
                            ((row as AuditRecord).notes ?? '') || '—'
                          )}
                        </td>
                        {canEditHistory ? (
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
                              <Button variant="danger" onClick={() => onDeleteAuditRecord(row.id)}>
                                Delete
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    )})}
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
