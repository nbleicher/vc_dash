import { useState } from 'react'
import { Button, Card, LoginForm, TopNav } from './components'
import { useDataStore } from './data'
import { useAppData } from './hooks'
import { CARRIERS, SLOT_CONFIG } from './constants'
import type { AttendancePercent, ExportFlags, QaRecord, TopPage, VaultMeeting } from './types'
import { csvEscape, estDateKey, estParts, uid } from './utils'
import { DashboardPage } from './pages/DashboardPage'
import { MetricsPage } from './pages/MetricsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { VaultPage } from './pages/VaultPage'

function App() {
  const store = useDataStore()
  const data = useAppData(store)
  const {
    agents,
    setAgents,
    qaRecords,
    setQaRecords,
    auditRecords,
    setAuditRecords,
    attendance,
    setAttendance,
    setSnapshots,
    setPerfHistory,
    attendanceSubmissions,
    setAttendanceSubmissions,
    intraSubmissions,
    setIntraSubmissions,
    setWeeklyTargets,
    vaultMeetings,
    setVaultMeetings,
    vaultDocs,
    setVaultDocs,
    loggedIn,
    login,
    logout,
    reload,
    isLoading,
    error,
    clearError,
  } = store

  const {
    now,
    todayKey,
    currentWeekKey,
    weekDates,
    activeAgents,
    houseLive,
    actionQa,
    actionAudit,
    incompleteQaAgentsToday,
    incompleteAuditAgentsToday,
    floorCapacity,
    weekTarget,
    weekTrend,
    attendanceAlert,
    intraAlert,
    overdueSlots,
    taskPage,
    setTaskPage,
    metricsScope,
    setMetricsScope,
    setMetricsAgentId,
    effectiveMetricsAgentId,
    metricsScopeData,
    rankRows,
    rankMetric,
    setRankMetric,
    rankPeriod,
    setRankPeriod,
    qaPassRate,
    auditRecoveryHours,
    activeAuditCount,
    setVaultAgentId,
    vaultHistoryView,
    setVaultHistoryView,
    vaultScope,
    setVaultScope,
    historySort,
    setHistorySort,
    effectiveVaultAgentId,
    selectedVaultAgent,
    vaultAttendanceHistory,
    vaultQaHistory,
    vaultAuditHistory,
    weeklyTargetHistory,
    snapshots,
    attendanceSubmissions: dataAttendanceSubmissions,
    intraSubmissions: dataIntraSubmissions,
    upsertSnapshot,
  } = data

  const [topPage, setTopPage] = useState<TopPage>('dashboard')
  const [newAgent, setNewAgent] = useState('')
  const [qaForm, setQaForm] = useState({ agentId: '', clientName: '', decision: 'Good Sale', notes: '' })
  const [auditForm, setAuditForm] = useState<{
    agentId: string
    carrier: string
    clientName: string
    reason: string
    currentStatus: string
  }>({
    agentId: '',
    carrier: CARRIERS[0] as string,
    clientName: '',
    reason: '',
    currentStatus: 'pending_cms',
  })
  const [meetingForm, setMeetingForm] = useState({
    dateKey: estDateKey(new Date()),
    meetingType: 'Coaching' as VaultMeeting['meetingType'],
    notes: '',
    actionItems: '',
  })
  const [attendanceNoteDraft, setAttendanceNoteDraft] = useState('')
  const [exportFlags, setExportFlags] = useState<ExportFlags>({
    agents: true,
    performanceHistory: true,
    qa: true,
    audit: true,
    attendance: true,
  })

  const ensureAgentDefault = (agentId: string): string => (agentId ? agentId : activeAgents[0]?.id ?? '')

  const isIntraSlotEditable = (slot: string): boolean => {
    const slotIndex = SLOT_CONFIG.findIndex((item) => item.key === slot)
    if (slotIndex === -1) return false
    const current = estParts(now)
    const currentMinute = current.hour * 60 + current.minute + current.second / 60
    const startMinute = SLOT_CONFIG[slotIndex].minuteOfDay
    const endMinute = SLOT_CONFIG[slotIndex + 1]?.minuteOfDay ?? 24 * 60
    return currentMinute >= startMinute && currentMinute < endMinute
  }

  const buildAttendanceDaySignature = (dateKey: string): string =>
    [...activeAgents]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((agent) => {
        const row = attendance.find((item) => item.agentId === agent.id && item.dateKey === dateKey)
        return `${agent.id}:${row?.percent ?? 'NA'}`
      })
      .join('|')

  const buildIntraSlotSignature = (dateKey: string, slot: string): string =>
    snapshots
      .filter((item) => item.dateKey === dateKey && item.slot === slot)
      .sort((a, b) => a.agentId.localeCompare(b.agentId))
      .map((item) => `${item.agentId}:${item.billableCalls}:${item.sales}`)
      .join('|')

  const [uiError, setUiError] = useState<string | null>(null)
  const pageMeta: Record<TopPage, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Monitor floor performance, alerts, and intra-day activity.' },
    tasks: { title: 'Tasks', subtitle: 'Manage attendance, QA, audits, and weekly targets.' },
    metrics: { title: 'Metrics', subtitle: 'Track KPIs and ranking trends across house and agent scope.' },
    vault: { title: 'Vault', subtitle: 'Review history, coaching notes, and document records.' },
    settings: { title: 'Settings', subtitle: 'Maintain agents and export operational data.' },
  }

  const handleLogin = async (username: string, password: string): Promise<void> => {
    try {
      await login(username, password)
      setUiError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed.'
      if (msg.toLowerCase().includes('fetch')) {
        setUiError('Cannot reach API server. Start backend with: npm run server:dev')
      } else if (msg.toLowerCase().includes('invalid credentials')) {
        setUiError('Invalid credentials. Use admin / admin.')
      } else {
        setUiError(msg)
      }
    }
  }

  const handleAddAgent = (e: React.FormEvent): void => {
    e.preventDefault()
    const name = newAgent.trim()
    if (!name) return
    setAgents((prev) => [...prev, { id: uid('agent'), name, active: true, createdAt: new Date().toISOString() }])
    setNewAgent('')
  }

  const handleQaSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const agentId = ensureAgentDefault(qaForm.agentId)
    if (!agentId || !qaForm.clientName.trim()) return
    const duplicate = qaRecords.some((r) => r.dateKey === todayKey && r.agentId === agentId)
    if (duplicate) {
      const agentName = agents.find((a) => a.id === agentId)?.name ?? 'Agent'
      const proceed = window.confirm(`QA for ${agentName} has already been done.`)
      if (!proceed) return
    }
    setQaRecords((prev) => [
      ...prev,
      {
        id: uid('qa'),
        dateKey: todayKey,
        agentId,
        clientName: qaForm.clientName.trim(),
        decision: qaForm.decision as QaRecord['decision'],
        status: qaForm.decision === 'Good Sale' ? 'Good' : 'Check Recording',
        notes: qaForm.notes.trim(),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      },
    ])
    setQaForm({ agentId: '', clientName: '', decision: 'Good Sale', notes: '' })
  }

  const handleAuditSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const agentId = ensureAgentDefault(auditForm.agentId)
    if (!agentId || !auditForm.clientName.trim()) return
    setAuditRecords((prev) => [
      ...prev,
      {
        id: uid('audit'),
        agentId,
        carrier: auditForm.carrier,
        clientName: auditForm.clientName.trim(),
        reason: auditForm.reason.trim(),
        currentStatus: auditForm.currentStatus,
        discoveryTs: new Date().toISOString(),
        mgmtNotified: false,
        outreachMade: false,
        resolutionTs: null,
      },
    ])
    setAuditForm({ agentId: '', carrier: CARRIERS[0], clientName: '', reason: '', currentStatus: 'pending_cms' })
  }

  const handleAuditNoActionSubmit = (): void => {
    if (!auditForm.agentId) {
      setUiError('Select an agent before submitting No Action Needed.')
      return
    }
    const agentId = auditForm.agentId
    const hasAnyToday = auditRecords.some((row) => row.agentId === agentId && row.discoveryTs.slice(0, 10) === todayKey)
    if (hasAnyToday) {
      const agentName = agents.find((a) => a.id === agentId)?.name ?? 'Agent'
      const proceed = window.confirm(`Audit for ${agentName} already has an entry today. Submit "No Action Needed" anyway?`)
      if (!proceed) return
    }
    const nowIso = new Date().toISOString()
    setAuditRecords((prev) => [
      ...prev.filter(
        (row) =>
          !(row.agentId === agentId && row.discoveryTs.slice(0, 10) === todayKey && row.currentStatus === 'no_action_needed'),
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
      },
    ])
    setUiError(null)
    setAuditForm((prev) => ({ ...prev, agentId: '' }))
  }

  const toggleAuditFlag = (id: string, field: 'mgmtNotified' | 'outreachMade'): void => {
    setAuditRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, [field]: !r[field] }
        if (next.mgmtNotified && next.outreachMade && !next.resolutionTs)
          next.resolutionTs = new Date().toISOString()
        return next
      }),
    )
  }

  const resolveQa = (id: string): void =>
    setQaRecords((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'Resolved', resolvedAt: new Date().toISOString() } : q)),
    )

  const setAttendancePercent = (agentId: string, dateKey: string, percent: AttendancePercent): void => {
    setAttendance((prev) => {
      const existing = prev.find((a) => a.agentId === agentId && a.dateKey === dateKey)
      if (!existing)
        return [...prev, { id: uid('att'), weekKey: currentWeekKey, dateKey, agentId, percent, notes: '' }]
      if (existing.percent !== percent) {
        const agentName = agents.find((a) => a.id === agentId)?.name ?? 'Agent'
        const proceed = window.confirm(`Attendance for ${agentName} on ${dateKey} already exists. Overwrite it?`)
        if (!proceed) return prev
      }
      return prev.map((a) => (a.id === existing.id ? { ...a, percent } : a))
    })
  }

  const submitAttendanceDay = (dateKey: string): void => {
    const nowIso = new Date().toISOString()
    const nextSignature = buildAttendanceDaySignature(dateKey)
    const existing = attendanceSubmissions.find((submission) => submission.dateKey === dateKey)
    if (existing && existing.daySignature !== nextSignature) {
      const proceed = window.confirm(`Attendance for ${dateKey} was already submitted. Overwrite submission?`)
      if (!proceed) return
    }
    setAttendanceSubmissions((prev) => {
      const current = prev.find((submission) => submission.dateKey === dateKey)
      if (!current) {
        return [
          ...prev,
          {
            id: uid('att_submit'),
            dateKey,
            submittedAt: nowIso,
            updatedAt: nowIso,
            submittedBy: 'manual',
            daySignature: nextSignature,
          },
        ]
      }
      return prev.map((submission) =>
        submission.id === current.id
          ? { ...submission, updatedAt: nowIso, submittedAt: nowIso, submittedBy: 'manual', daySignature: nextSignature }
          : submission,
      )
    })
  }

  const submitIntraSlot = (slot: string): void => {
    if (!SLOT_CONFIG.some((item) => item.key === slot)) return
    if (!isIntraSlotEditable(slot)) {
      setUiError(`The ${slot} slot is locked and can no longer be edited.`)
      return
    }
    const nowIso = new Date().toISOString()
    const existing = intraSubmissions.find((submission) => submission.dateKey === todayKey && submission.slot === slot)
    if (existing) {
      const proceed = window.confirm(`Intra-day entry for ${slot} is already submitted. Re-submit this hour?`)
      if (!proceed) return
    }
    const slotSignature = buildIntraSlotSignature(todayKey, slot)
    setIntraSubmissions((prev) => {
      const current = prev.find((submission) => submission.dateKey === todayKey && submission.slot === slot)
      if (!current) {
        return [
          ...prev,
          {
            id: uid('intra_submit'),
            dateKey: todayKey,
            slot,
            submittedAt: nowIso,
            updatedAt: nowIso,
            submittedBy: 'manual',
            slotSignature,
          },
        ]
      }
      return prev.map((submission) =>
        submission.id === current.id
          ? { ...submission, updatedAt: nowIso, submittedAt: nowIso, submittedBy: 'manual', slotSignature }
          : submission,
      )
    })
  }

  const upsertIntraSnapshot = (
    slot: (typeof SLOT_CONFIG)[number],
    agentId: string,
    calls: number,
    sales: number,
  ): void => {
    if (!isIntraSlotEditable(slot.key)) {
      setUiError(`The ${slot.label} window has closed. Select a current editable slot.`)
      return
    }
    upsertSnapshot(slot, agentId, calls, sales)
  }

  const saveAttendanceNote = (agentId: string, dateKey: string): void => {
    setAttendance((prev) => {
      const existing = prev.find((a) => a.agentId === agentId && a.dateKey === dateKey)
      if (!existing)
        return [
          ...prev,
          {
            id: uid('att'),
            weekKey: currentWeekKey,
            dateKey,
            agentId,
            percent: 100,
            notes: attendanceNoteDraft.trim(),
          },
        ]
      return prev.map((a) => (a.id === existing.id ? { ...a, notes: attendanceNoteDraft.trim() } : a))
    })
    setAttendanceNoteDraft('')
  }

  const saveWeeklyTarget = (sales: number, cpa: number): void => {
    setWeeklyTargets((prev) => {
      const existing = prev.find((w) => w.weekKey === currentWeekKey)
      if (!existing)
        return [...prev, { weekKey: currentWeekKey, targetSales: sales, targetCpa: cpa, setAt: new Date().toISOString() }]
      return prev.map((w) =>
        w.weekKey === currentWeekKey ? { ...w, targetSales: sales, targetCpa: cpa, setAt: new Date().toISOString() } : w,
      )
    })
  }

  const addMeeting = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!selectedVaultAgent) return
    setVaultMeetings((prev) => [
      ...prev,
      {
        id: uid('meet'),
        agentId: selectedVaultAgent.id,
        dateKey: meetingForm.dateKey,
        meetingType: meetingForm.meetingType,
        notes: meetingForm.notes.trim(),
        actionItems: meetingForm.actionItems.trim(),
      },
    ])
    setMeetingForm({ dateKey: estDateKey(new Date()), meetingType: 'Coaching', notes: '', actionItems: '' })
  }

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!selectedVaultAgent) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUiError('PDF only uploads are allowed.')
      e.target.value = ''
      return
    }
    setVaultDocs((prev) => [
      ...prev,
      {
        id: uid('doc'),
        agentId: selectedVaultAgent.id,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    ])
    e.target.value = ''
  }

  const runExport = (): void => {
    const lines: string[] = []
    if (exportFlags.agents) {
      lines.push('AGENTS', 'id,name,active,createdAt')
      for (const a of agents) lines.push([a.id, a.name, a.active, a.createdAt].map(csvEscape).join(','))
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
      for (const q of qaRecords)
        lines.push(
          [q.id, q.dateKey, q.agentId, q.clientName, q.decision, q.status, q.notes, q.createdAt, q.resolvedAt]
            .map(csvEscape)
            .join(','),
        )
      lines.push('')
    }
    if (exportFlags.audit) {
      lines.push(
        'MASTER_AUDIT',
        'id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs',
      )
      for (const a of auditRecords)
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
          ]
            .map(csvEscape)
            .join(','),
        )
      lines.push('')
    }
    if (exportFlags.attendance) {
      lines.push('ATTENDANCE', 'id,weekKey,dateKey,agentId,percent,notes')
      for (const a of attendance)
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
  }

  const clearHistory = (): void => {
    const proceed = window.confirm(
      'This will permanently clear all dashboard data (agents, attendance, snapshots, QA, audits, targets, vault). Continue?',
    )
    if (!proceed) return
    setAgents([])
    setQaRecords([])
    setAuditRecords([])
    setSnapshots([])
    setAttendance([])
    setAttendanceSubmissions([])
    setIntraSubmissions([])
    setPerfHistory([])
    setWeeklyTargets([])
    setVaultMeetings([])
    setVaultDocs([])
    setUiError(null)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md space-y-3">
          <h1>Loading dashboard...</h1>
          {error ? (
            <>
              <p className="text-sm text-slate-500" role="alert">
                {error}
              </p>
              <Button type="button" onClick={() => void reload()}>
                Retry
              </Button>
            </>
          ) : null}
        </Card>
      </div>
    )
  }

  if (!loggedIn) {
    return <LoginForm onLogin={handleLogin} error={uiError ?? error} />
  }

  return (
    <div className="mx-auto max-w-[1480px] p-4 md:p-6">
      <header className="panel top-shell">
        <div className="top-shell-nav">
          <TopNav topPage={topPage} setTopPage={setTopPage} />
        </div>
        <div className="top-shell-actions">
          <Button variant="danger" onClick={() => void logout()}>
            Sign Out
          </Button>
        </div>
      </header>
      <main className="page-grid mt-4">
        <section className="panel page-head">
          <div className="page-head-copy">
            <p className="page-kicker">VC Dashboard</p>
            <h2>{pageMeta[topPage].title}</h2>
            <p className="page-subtext">{pageMeta[topPage].subtitle}</p>
          </div>
        </section>
        {(uiError || error) && (
          <section className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-red-800 shadow-soft">
            <strong>Action required</strong>
            <p>{uiError ?? error}</p>
            <Button
              type="button"
              variant="danger"
              className="mt-3"
              onClick={() => {
                setUiError(null)
                clearError()
              }}
            >
              Dismiss
            </Button>
          </section>
        )}

        {topPage === 'dashboard' && (
          <DashboardPage
            agents={agents}
            activeAgents={activeAgents}
            todayKey={todayKey}
            now={now}
            houseLive={houseLive}
            floorCapacity={floorCapacity}
            weekTarget={weekTarget}
            weekTrend={weekTrend}
            actionQa={actionQa}
            actionAudit={actionAudit}
            attendanceAlert={attendanceAlert}
            intraAlert={intraAlert}
            overdueSlots={overdueSlots}
            snapshots={snapshots}
            intraSubmissions={dataIntraSubmissions}
            onResolveQa={resolveQa}
            onToggleAuditFlag={toggleAuditFlag}
            onGoToAttendance={() => {
              setTopPage('tasks')
              setTaskPage('attendance')
            }}
            onUpsertSnapshot={upsertIntraSnapshot}
            onSubmitIntraSlot={submitIntraSlot}
            isIntraSlotEditable={isIntraSlotEditable}
          />
        )}

        {topPage === 'tasks' && (
          <TasksPage
            taskPage={taskPage}
            setTaskPage={setTaskPage}
            todayKey={todayKey}
            activeAgents={activeAgents}
            attendance={attendance}
            attendanceSubmissions={dataAttendanceSubmissions}
            weekDates={weekDates}
            weekTarget={weekTarget}
            qaForm={qaForm}
            setQaForm={setQaForm}
            auditForm={auditForm}
            setAuditForm={setAuditForm}
            incompleteQaAgentsToday={incompleteQaAgentsToday}
            incompleteAuditAgentsToday={incompleteAuditAgentsToday}
            onSetAttendancePercent={setAttendancePercent}
            onSubmitAttendanceDay={submitAttendanceDay}
            onSaveWeeklyTarget={saveWeeklyTarget}
            onQaSubmit={handleQaSubmit}
            onAuditSubmit={handleAuditSubmit}
            onAuditNoActionSubmit={handleAuditNoActionSubmit}
          />
        )}

        {topPage === 'metrics' && (
          <MetricsPage
            metricsScope={metricsScope}
            setMetricsScope={setMetricsScope}
            setMetricsAgentId={setMetricsAgentId}
            effectiveMetricsAgentId={effectiveMetricsAgentId}
            activeAgents={activeAgents}
            metricsScopeData={metricsScopeData}
            qaPassRate={qaPassRate}
            auditRecoveryHours={auditRecoveryHours}
            activeAuditCount={activeAuditCount}
            rankRows={rankRows}
            rankMetric={rankMetric}
            setRankMetric={setRankMetric}
            rankPeriod={rankPeriod}
            setRankPeriod={setRankPeriod}
          />
        )}

        {topPage === 'vault' && (
          <VaultPage
            vaultScope={vaultScope}
            setVaultScope={setVaultScope}
            setVaultAgentId={setVaultAgentId}
            effectiveVaultAgentId={effectiveVaultAgentId}
            selectedVaultAgent={selectedVaultAgent}
            activeAgents={activeAgents}
            vaultHistoryView={vaultHistoryView}
            setVaultHistoryView={setVaultHistoryView}
            historySort={historySort}
            setHistorySort={setHistorySort}
            agents={agents}
            vaultDocs={vaultDocs}
            vaultMeetings={vaultMeetings}
            meetingForm={meetingForm}
            setMeetingForm={setMeetingForm}
            attendanceNoteDraft={attendanceNoteDraft}
            setAttendanceNoteDraft={setAttendanceNoteDraft}
            vaultAttendanceHistory={vaultAttendanceHistory}
            vaultQaHistory={vaultQaHistory}
            vaultAuditHistory={vaultAuditHistory}
            weeklyTargetHistory={weeklyTargetHistory}
            onSaveAttendanceNote={saveAttendanceNote}
            onAddMeeting={addMeeting}
            onPdfUpload={handlePdfUpload}
          />
        )}

        {topPage === 'settings' && (
          <SettingsPage
            agents={agents}
            setAgents={setAgents}
            newAgent={newAgent}
            setNewAgent={setNewAgent}
            exportFlags={exportFlags}
            setExportFlags={setExportFlags}
            onAddAgent={handleAddAgent}
            onRunExport={runExport}
            onClearHistory={clearHistory}
          />
        )}
      </main>
    </div>
  )
}

export default App
