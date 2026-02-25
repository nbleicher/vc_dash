import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DataStore } from '../data'
import { Badge, Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Textarea } from '../components'
import { POLICY_STATUSES } from '../constants'

const AUDIT_STATUS_OPTIONS = [...POLICY_STATUSES, 'no_action_needed']
import type { AuditRecord, QaRecord, VaultHistoryView, VaultScope, VaultMeeting } from '../types'
import { estDateKey, formatDateKey, formatLastParsedDate, formatNum, formatPctDelta, formatTimestamp } from '../utils'

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
  snapshots: DataStore['snapshots']
  lastPoliciesBotRun: string | null
  onAddMeeting: (e: React.FormEvent) => void
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUpdateQaRecord: (
    recordId: string,
    patch: Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'>,
  ) => void
  onUpdateAuditRecord: (
    recordId: string,
    patch: Pick<AuditRecord, 'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'>,
  ) => void
  onDeleteAuditRecord: (recordId: string) => void
  onUpdateSnapshot: (
    rowId: string,
    patch: Pick<DataStore['snapshots'][number], 'billableCalls' | 'sales'>,
  ) => void
  onUpdateMeeting: (
    meetingId: string,
    patch: Pick<VaultMeeting, 'dateKey' | 'meetingType' | 'notes' | 'actionItems'>,
  ) => void
}

const PAGE_SIZE = 50
const QUICK_VIEW_ROWS = 5

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
  snapshots,
  lastPoliciesBotRun,
  onAddMeeting,
  onPdfUpload,
  onUpdateQaRecord,
  onUpdateAuditRecord,
  onDeleteAuditRecord,
  onUpdateSnapshot,
  onUpdateMeeting,
}: Props) {
  const [fullTableMode, setFullTableMode] = useState<'qa' | 'audit' | null>(null)
  const [popupSearch, setPopupSearch] = useState('')
  const [popupPage, setPopupPage] = useState(1)
  const [editingQaId, setEditingQaId] = useState<string | null>(null)
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null)
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const [qaDraft, setQaDraft] = useState<Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'> | null>(
    null,
  )
  const [auditDraft, setAuditDraft] = useState<
    Pick<AuditRecord, 'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'> | null
  >(null)
  const [snapshotDraft, setSnapshotDraft] = useState<Pick<DataStore['snapshots'][number], 'billableCalls' | 'sales'> | null>(null)
  const [meetingDraft, setMeetingDraft] = useState<
    Pick<VaultMeeting, 'dateKey' | 'meetingType' | 'notes' | 'actionItems'> | null
  >(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [houseIntraDay, setHouseIntraDay] = useState<string>(() => estDateKey(new Date()))
  const scopeValue = vaultScope === 'house' ? '__house__' : effectiveVaultAgentId

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
  const recentHouseDayOptions = useMemo(() => {
    const options: string[] = []
    const now = new Date()
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      options.push(estDateKey(d))
    }
    return options
  }, [])
  const intraRowsForDay = useMemo(
    () =>
      snapshots
        .filter((row) => row.dateKey === houseIntraDay && row.slot === '17:00')
        .sort((a, b) => agentName(a.agentId).localeCompare(agentName(b.agentId))),
    [snapshots, houseIntraDay, agentName],
  )

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

  const startSnapshotEdit = (row: DataStore['snapshots'][number]): void => {
    setEditingSnapshotId(row.id)
    setSnapshotDraft({ billableCalls: row.billableCalls, sales: row.sales })
    setEditError(null)
  }

  const cancelSnapshotEdit = (): void => {
    setEditingSnapshotId(null)
    setSnapshotDraft(null)
    setEditError(null)
  }

  const saveSnapshotEdit = (): void => {
    if (!editingSnapshotId || !snapshotDraft) return
    const billableCalls = Math.max(0, Math.round(snapshotDraft.billableCalls))
    const sales = Math.max(0, Math.round(snapshotDraft.sales))
    onUpdateSnapshot(editingSnapshotId, { billableCalls, sales })
    cancelSnapshotEdit()
  }

  const startMeetingEdit = (m: VaultMeeting): void => {
    setEditingMeetingId(m.id)
    setMeetingDraft({
      dateKey: m.dateKey,
      meetingType: m.meetingType,
      notes: m.notes,
      actionItems: m.actionItems,
    })
    setEditError(null)
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

  const renderHouseIntraDayHistoryCard = () => (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3>Intra-Day Performance Entry History</h3>
        <p className="text-sm text-slate-500">{formatDateKey(houseIntraDay)}</p>
      </div>
      <TableWrap>
        <DataTable>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Slot</th>
              <th>Billable Calls</th>
              <th>Sales</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {intraRowsForDay.length === 0 && (
              <tr>
                <td colSpan={6}>No 5:00 PM entry for this day.</td>
              </tr>
            )}
            {intraRowsForDay.map((row) => (
              <tr key={row.id}>
                <td>{agentName(row.agentId)}</td>
                <td>{row.slotLabel || row.slot}</td>
                <td>
                  {editingSnapshotId === row.id && snapshotDraft ? (
                    <Input
                      type="number"
                      min={0}
                      value={snapshotDraft.billableCalls}
                      onChange={(e) =>
                        setSnapshotDraft((prev) =>
                          prev ? { ...prev, billableCalls: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0 } : prev,
                        )
                      }
                    />
                  ) : (
                    row.billableCalls
                  )}
                </td>
                <td>
                  {editingSnapshotId === row.id && snapshotDraft ? (
                    <Input
                      type="number"
                      min={0}
                      value={snapshotDraft.sales}
                      onChange={(e) =>
                        setSnapshotDraft((prev) =>
                          prev ? { ...prev, sales: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0 } : prev,
                        )
                      }
                    />
                  ) : (
                    row.sales
                  )}
                </td>
                <td>{formatTimestamp(row.updatedAt)}</td>
                <td>
                  {editingSnapshotId === row.id ? (
                    <div className="flex gap-2">
                      <Button variant="default" onClick={saveSnapshotEdit}>
                        Save
                      </Button>
                      <Button variant="secondary" onClick={cancelSnapshotEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => startSnapshotEdit(row)}
                      disabled={
                        !!editingQaId ||
                        !!editingAuditId ||
                        (editingSnapshotId !== null && editingSnapshotId !== row.id)
                      }
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
  )

  const renderAgentHistorySection = () => (
    <>
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

      {vaultHistoryView === 'qa' && renderQaHistoryCard(vaultQaHistory, true, canEditHistory)}

      {vaultHistoryView === 'audit' && renderAuditHistoryCard(vaultAuditHistory, true, canEditHistory)}

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
  )

  return (
    <Card className="space-y-4">
      <CardTitle>Vault</CardTitle>
      <div className="row-wrap control-bar">
        <Field className="min-w-[260px]">
          <FieldLabel>Scope</FieldLabel>
          <Select
            value={scopeValue}
            onChange={(e) => {
              const next = e.target.value
              if (next === '__house__') {
                setVaultScope('house')
                return
              }
              setVaultScope('agent')
              setVaultAgentId(next)
            }}
          >
            <option value="__house__">House (All Agents)</option>
            {activeAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </Select>
        </Field>
        {vaultScope === 'agent' ? (
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
        ) : null}
        {vaultScope === 'house' ? (
          <Field className="min-w-[220px]">
            <FieldLabel>Day</FieldLabel>
            <Select value={houseIntraDay} onChange={(e) => setHouseIntraDay(e.target.value)}>
              {recentHouseDayOptions.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {formatDateKey(dateKey)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field className="min-w-[180px]">
          <FieldLabel>Sort</FieldLabel>
          <Select value={historySort} onChange={(e) => setHistorySort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </Field>
      </div>
      {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
      {vaultScope === 'house' ? (
        <>
          <div className="split">
            {renderQaHistoryCard(vaultQaHistory, true, canEditHistory)}
            {renderAuditHistoryCard(vaultAuditHistory, true, canEditHistory)}
          </div>
          {renderHouseIntraDayHistoryCard()}
        </>
      ) : !selectedVaultAgent ? (
        <p className="text-sm text-slate-500">N/A - add/select an active agent.</p>
      ) : (
        <>
          {renderAgentHistorySection()}
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
                    {(() => {
                      const meetingsForAgent = vaultMeetings
                        .filter((m) => m.agentId === selectedVaultAgent.id)
                        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
                      if (meetingsForAgent.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5}>No meetings logged.</td>
                          </tr>
                        )
                      }
                      return meetingsForAgent.map((m) => (
                        <tr key={m.id}>
                          <td>
                            {editingMeetingId === m.id && meetingDraft ? (
                              <Input
                                type="date"
                                value={meetingDraft.dateKey}
                                onChange={(e) =>
                                  setMeetingDraft((prev) => (prev ? { ...prev, dateKey: e.target.value } : prev))
                                }
                              />
                            ) : (
                              formatDateKey(m.dateKey)
                            )}
                          </td>
                          <td>
                            {editingMeetingId === m.id && meetingDraft ? (
                              <Select
                                value={meetingDraft.meetingType}
                                onChange={(e) =>
                                  setMeetingDraft((prev) =>
                                    prev
                                      ? { ...prev, meetingType: e.target.value as VaultMeeting['meetingType'] }
                                      : prev,
                                  )
                                }
                              >
                                <option value="Coaching">Coaching</option>
                                <option value="Warning">Warning</option>
                                <option value="Review">Review</option>
                                <option value="Transfer">Transfer</option>
                              </Select>
                            ) : (
                              m.meetingType
                            )}
                          </td>
                          <td>
                            {editingMeetingId === m.id && meetingDraft ? (
                              <Textarea
                                value={meetingDraft.notes}
                                onChange={(e) =>
                                  setMeetingDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                                }
                                rows={2}
                                className="min-w-[160px]"
                              />
                            ) : (
                              m.notes || 'N/A'
                            )}
                          </td>
                          <td>
                            {editingMeetingId === m.id && meetingDraft ? (
                              <Textarea
                                value={meetingDraft.actionItems}
                                onChange={(e) =>
                                  setMeetingDraft((prev) => (prev ? { ...prev, actionItems: e.target.value } : prev))
                                }
                                rows={2}
                                className="min-w-[160px]"
                              />
                            ) : (
                              m.actionItems || 'N/A'
                            )}
                          </td>
                          <td>
                            {editingMeetingId === m.id ? (
                              <div className="flex gap-2">
                                <Button variant="default" onClick={saveMeetingEdit}>
                                  Save
                                </Button>
                                <Button variant="secondary" onClick={cancelMeetingEdit}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                onClick={() => startMeetingEdit(m)}
                                disabled={
                                  !!editingQaId ||
                                  !!editingAuditId ||
                                  editingSnapshotId !== null ||
                                  (editingMeetingId !== null && editingMeetingId !== m.id)
                                }
                              >
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Card>
          </div>
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
