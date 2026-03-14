import { useCallback } from 'react'
import type { DataStore } from '../data'
import type { QaRecord, TransferRecord } from '../types'
import { uid } from '../utils'

type TaskActionsData = {
  todayKey: string
  currentWeekKey: string
  selectedAttendanceWeekKey: string
  activeAgents: { id: string; name: string }[]
}

export type QaFormState = {
  dateKey: string
  agentId: string
  clientName: string
  decision: 'Good Sale' | 'Check Recording'
  callId: string
  notes: string
}

export function useTaskActions(
  store: DataStore,
  data: TaskActionsData,
  qaForm: QaFormState,
  setQaForm: React.Dispatch<React.SetStateAction<QaFormState>>,
  auditForm: { agentId: string },
  setAuditForm: React.Dispatch<React.SetStateAction<{ agentId: string }>>,
  setUiError: (msg: string | null) => void,
) {
  const { todayKey, currentWeekKey, selectedAttendanceWeekKey, activeAgents } = data
  const ensureAgentDefault = useCallback(
    (agentId: string): string => (agentId ? agentId : activeAgents[0]?.id ?? ''),
    [activeAgents],
  )

  const handleQaSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault()
      const agentId = ensureAgentDefault(qaForm.agentId)
      if (!agentId || !qaForm.clientName.trim()) return
      if (qaForm.decision === 'Check Recording' && !qaForm.callId.trim()) {
        setUiError('Call ID is required when decision is Check Recording.')
        return
      }
      const duplicate = store.qaRecords.some((r) => r.dateKey === qaForm.dateKey && r.agentId === agentId)
      if (duplicate) {
        const agentName = store.agents.find((a) => a.id === agentId)?.name ?? 'Agent'
        const proceed = window.confirm(`QA for ${agentName} has already been done.`)
        if (!proceed) return
      }
      const trimmedNotes = qaForm.notes.trim()
      const callIdNote = qaForm.callId.trim() ? `Call ID: ${qaForm.callId.trim()}` : ''
      const qaNotes =
        qaForm.decision === 'Check Recording' && callIdNote
          ? `${trimmedNotes ? `${trimmedNotes}\n` : ''}${callIdNote}`
          : trimmedNotes
      store.setQaRecords((prev) => [
        ...prev,
        {
          id: uid('qa'),
          dateKey: qaForm.dateKey,
          agentId,
          clientName: qaForm.clientName.trim(),
          decision: qaForm.decision as QaRecord['decision'],
          status: qaForm.decision === 'Good Sale' ? 'Good' : 'Check Recording',
          notes: qaNotes,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
        },
      ])
      const reset: QaFormState = {
        dateKey: todayKey,
        agentId: '',
        clientName: '',
        decision: 'Good Sale',
        callId: '',
        notes: '',
      }
      setQaForm(reset)
      setUiError(null)
    },
    [
      store,
      qaForm,
      setQaForm,
      todayKey,
      ensureAgentDefault,
      setUiError,
    ],
  )

  const handleSaveEodReport = useCallback(
    (weekKey: string, reportText: string, houseSales: number, houseCpa: number | null): void => {
      store.setEodReports((prev) => [
        ...prev,
        {
          id: uid('eod'),
          weekKey,
          dateKey: todayKey,
          houseSales,
          houseCpa,
          reportText: reportText.trim(),
          submittedAt: new Date().toISOString(),
        },
      ])
    },
    [store, todayKey],
  )

  const handleAuditNoActionSubmit = useCallback((): void => {
    if (!auditForm.agentId) {
      setUiError('Select an agent before submitting No Action Needed.')
      return
    }
    const agentId = auditForm.agentId
    const hasAnyToday = store.auditRecords.some(
      (row) => row.agentId === agentId && row.discoveryTs.slice(0, 10) === todayKey,
    )
    if (hasAnyToday) {
      const agentName = store.agents.find((a) => a.id === agentId)?.name ?? 'Agent'
      const proceed = window.confirm(
        `Audit for ${agentName} already has an entry today. Submit "No Action Needed" anyway?`,
      )
      if (!proceed) return
    }
    const nowIso = new Date().toISOString()
    store.setAuditRecords((prev) => [
      ...prev.filter(
        (row) =>
          !(
            row.agentId === agentId &&
            row.discoveryTs.slice(0, 10) === todayKey &&
            row.currentStatus === 'no_action_needed'
          ),
      ),
      {
        id: uid('audit'),
        agentId,
        carrier: 'N/A',
        clientName: 'N/A',
        reason: 'No action needed for day',
        currentStatus: 'no_action_needed',
        discoveryTs: nowIso,
        mgmtNotified: true,
        outreachMade: true,
        resolutionTs: nowIso,
        notes: '',
      },
    ])
    setUiError(null)
    setAuditForm((prev) => ({ ...prev, agentId: '' }))
  }, [store, auditForm.agentId, todayKey, setAuditForm, setUiError])

  const toggleAuditFlag = useCallback(
    (id: string, field: 'mgmtNotified' | 'outreachMade'): void => {
      store.setAuditRecords((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          const next = { ...r, [field]: !r[field] }
          if (next.mgmtNotified && next.outreachMade && !next.resolutionTs)
            next.resolutionTs = new Date().toISOString()
          return next
        }),
      )
    },
    [store],
  )

  const resolveQa = useCallback(
    (id: string): void =>
      store.setQaRecords((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: 'Resolved', resolvedAt: new Date().toISOString() } : q)),
      ),
    [store],
  )

  const handleQaUpdate = useCallback(
    (
      id: string,
      patch: Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'>,
    ): void => {
      store.setQaRecords((prev) =>
        prev.map((record) =>
          record.id === id
            ? {
                ...record,
                agentId: patch.agentId,
                dateKey: patch.dateKey,
                clientName: patch.clientName,
                decision: patch.decision,
                status: patch.status,
                notes: patch.notes,
              }
            : record,
        ),
      )
    },
    [store],
  )

  const handleAuditUpdate = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          (typeof store.auditRecords)[number],
          'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'
        >
      >,
    ): void => {
      const resolvedPatch =
        patch.currentStatus === 'accepted'
          ? { ...patch, resolutionTs: new Date().toISOString() }
          : patch
      store.setAuditRecords((prev) =>
        prev.map((record) => (record.id === id ? { ...record, ...resolvedPatch } : record)),
      )
    },
    [store],
  )

  const handleAuditDelete = useCallback((id: string): void => {
    if (!window.confirm('Delete this audit record?')) return
    store.setAuditRecords((prev) => prev.filter((r) => r.id !== id))
  }, [store])

  const setSpiffAmount = useCallback(
    (agentId: string, dateKey: string, amount: number): void => {
      const nextAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : 0
      store.setSpiffRecords((prev) => {
        const existing = prev.find((row) => row.agentId === agentId && row.dateKey === dateKey)
        if (!existing) {
          return [...prev, { id: uid('spiff'), weekKey: selectedAttendanceWeekKey, dateKey, agentId, amount: nextAmount }]
        }
        return prev.map((row) => (row.id === existing.id ? { ...row, amount: nextAmount } : row))
      })
    },
    [store, selectedAttendanceWeekKey],
  )

  const saveWeeklyTarget = useCallback(
    (sales: number, cpa: number): void => {
      store.setWeeklyTargets((prev) => {
        const existing = prev.find((w) => w.weekKey === currentWeekKey)
        if (!existing)
          return [
            ...prev,
            { weekKey: currentWeekKey, targetSales: sales, targetCpa: cpa, setAt: new Date().toISOString() },
          ]
        return prev.map((w) =>
          w.weekKey === currentWeekKey
            ? { ...w, targetSales: sales, targetCpa: cpa, setAt: new Date().toISOString() }
            : w,
        )
      })
    },
    [store, currentWeekKey],
  )

  const handleAddTransfer = useCallback(
    (transfer: Omit<TransferRecord, 'id'>): void => {
      store.setTransfers((prev) => [...prev, { ...transfer, id: uid('transfer') }])
    },
    [store],
  )

  const handleDeleteTransfer = useCallback((id: string): void => {
    store.setTransfers((prev) => prev.filter((row) => row.id !== id))
  }, [store])

  return {
    handleQaSubmit,
    handleSaveEodReport,
    handleAuditNoActionSubmit,
    toggleAuditFlag,
    resolveQa,
    handleQaUpdate,
    handleAuditUpdate,
    handleAuditDelete,
    setSpiffAmount,
    saveWeeklyTarget,
    handleAddTransfer,
    handleDeleteTransfer,
  }
}
