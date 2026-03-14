import { useCallback } from 'react'
import type { DataStore } from '../data'
import type { ExportFlags } from '../types'
import { csvEscape } from '../utils'

export function useSettingsActions(
  store: DataStore,
  exportFlags: ExportFlags,
  todayKey: string,
  setUiError: (msg: string | null) => void,
) {
  const runExport = useCallback((): void => {
    const lines: string[] = []
    if (exportFlags.agents) {
      lines.push('AGENTS', 'id,name,active,createdAt')
      for (const a of store.agents)
        lines.push([a.id, a.name, a.active, a.createdAt].map(csvEscape).join(','))
      lines.push('')
    }
    if (exportFlags.performanceHistory) {
      lines.push('PERFORMANCE_HISTORY', 'id,dateKey,agentId,billableCalls,sales,marketing,cpa,cvr,frozenAt')
      for (const p of store.perfHistory)
        lines.push(
          [
            p.id,
            p.dateKey,
            p.agentId,
            p.billableCalls,
            p.sales,
            p.marketing,
            p.cpa ?? 'N/A',
            p.cvr ?? 'N/A',
            p.frozenAt,
          ]
            .map(csvEscape)
            .join(','),
        )
      lines.push('')
    }
    if (exportFlags.qa) {
      lines.push('MASTER_QA', 'id,dateKey,agentId,clientName,decision,status,notes,createdAt,resolvedAt')
      for (const q of store.qaRecords)
        lines.push(
          [
            q.id,
            q.dateKey,
            q.agentId,
            q.clientName,
            q.decision,
            q.status,
            q.notes,
            q.createdAt,
            q.resolvedAt,
          ]
            .map(csvEscape)
            .join(','),
        )
      lines.push('')
    }
    if (exportFlags.audit) {
      lines.push(
        'MASTER_AUDIT',
        'id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs,notes',
      )
      for (const a of store.auditRecords)
        lines.push(
          [
            a.id,
            a.agentId,
            a.carrier,
            a.clientName,
            a.reason,
            a.currentStatus,
            a.discoveryTs,
            a.mgmtNotified,
            a.outreachMade,
            a.resolutionTs,
            a.notes ?? '',
          ]
            .map(csvEscape)
            .join(','),
        )
      lines.push('')
    }
    if (exportFlags.attendance) {
      lines.push('ATTENDANCE', 'id,weekKey,dateKey,agentId,percent,notes')
      for (const a of store.attendance)
        lines.push([a.id, a.weekKey, a.dateKey, a.agentId, a.percent, a.notes].map(csvEscape).join(','))
      lines.push('')
    }
    if (lines.length === 0) {
      setUiError('Select at least one export section.')
      return
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vc_dashboard_export_${todayKey}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [
    store.agents,
    store.perfHistory,
    store.qaRecords,
    store.auditRecords,
    store.attendance,
    exportFlags,
    todayKey,
    setUiError,
  ])

  const clearHistory = useCallback((): void => {
    const proceed = window.confirm(
      'This will permanently clear all dashboard data (agents, attendance, spiff, snapshots, QA, audits, targets, vault). Continue?',
    )
    if (!proceed) return
    store.setAgents([])
    store.setQaRecords([])
    store.setAuditRecords([])
    store.setSnapshots([])
    void store.pushSnapshotsToApi([])
    store.setAttendance([])
    store.setSpiffRecords([])
    store.setAttendanceSubmissions([])
    store.setIntraSubmissions([])
    store.setPerfHistory([])
    store.setWeeklyTargets([])
    store.setVaultMeetings([])
    store.setVaultDocs([])
    setUiError(null)
  }, [store, setUiError])

  return { runExport, clearHistory }
}
