import { useState } from 'react'
import { Button, Card, LoginForm, TopNav } from './components'
import { useDataStore } from './data'
import { useAppData } from './hooks'
import { CARRIERS } from './constants'
import type { AttendancePercent, ExportFlags, QaRecord, TopPage, VaultMeeting } from './types'
import { csvEscape, estDateKey, formatDateKey, uid } from './utils'
import { DashboardPage } from './pages/DashboardPage'
import { MetricsPage } from './pages/MetricsPage'
import { EodPage } from './pages/EodPage'
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
    spiffRecords,
    setSpiffRecords,
    setSnapshots,
    pushSnapshotsToApi,
    setPerfHistory,
    attendanceSubmissions,
    setAttendanceSubmissions,
    setIntraSubmissions,
    setWeeklyTargets,
    vaultMeetings,
    setVaultMeetings,
    vaultDocs,
    setVaultDocs,
    eodReports,
    setEodReports,
    loggedIn,
    login,
    logout,
    reload,
    lastFetchedAt,
    isLoading,
    error,
    clearError,
  } = store

  const {
    now,
    todayKey,
    currentWeekKey,
    selectedAttendanceWeekKey,
    setSelectedAttendanceWeekKey,
    attendanceWeekDates,
    attendanceWeekOptions,
    activeAgents,
    houseLive,
    agentPerformanceRows,
    lastSnapshotLabel,
    actionQa,
    actionAudit,
    incompleteQaAgentsToday,
    incompleteAuditAgentsToday,
    floorCapacity,
    weekTarget,
    weekTrend,
    house6pmSnapshotForToday,
    attendanceAlert,
    taskPage,
    setTaskPage,
    selectedEodWeekKey,
    setSelectedEodWeekKey,
    eodWeekOptions,
    eodWeeklyRows,
    eodWeeklySummary,
    monthLabel,
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
    kpiPeriod,
    setKpiPeriod,
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
  } = data

  const [topPage, setTopPage] = useState<TopPage>('dashboard')
  const [newAgent, setNewAgent] = useState('')
  const [qaForm, setQaForm] = useState({ agentId: '', clientName: '', decision: 'Good Sale', callId: '', notes: '' })
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
  const [exportFlags, setExportFlags] = useState<ExportFlags>({
    agents: true,
    performanceHistory: true,
    qa: true,
    audit: true,
    attendance: true,
  })

  const ensureAgentDefault = (agentId: string): string => (agentId ? agentId : activeAgents[0]?.id ?? '')

  const buildAttendanceDaySignature = (dateKey: string): string =>
    [...activeAgents]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((agent) => {
        const row = attendance.find((item) => item.agentId === agent.id && item.dateKey === dateKey)
        return `${agent.id}:${row?.percent ?? 'NA'}`
      })
      .join('|')

  const [uiError, setUiError] = useState<string | null>(null)
  const pageMeta: Record<TopPage, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Monitor floor performance, alerts, and intra-day activity.' },
    tasks: { title: 'Tasks', subtitle: 'Manage attendance, QA, audits, and weekly targets.' },
    metrics: { title: 'Metrics', subtitle: 'Track KPIs and ranking trends across house and agent scope.' },
    eod: { title: 'EOD', subtitle: 'Review weekly totals and end-of-week house summary snapshots.' },
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
    if (qaForm.decision === 'Check Recording' && !qaForm.callId.trim()) {
      setUiError('Call ID is required when decision is Check Recording.')
      return
    }
    const duplicate = qaRecords.some((r) => r.dateKey === todayKey && r.agentId === agentId)
    if (duplicate) {
      const agentName = agents.find((a) => a.id === agentId)?.name ?? 'Agent'
      const proceed = window.confirm(`QA for ${agentName} has already been done.`)
      if (!proceed) return
    }
    const trimmedNotes = qaForm.notes.trim()
    const callIdNote = qaForm.callId.trim() ? `Call ID: ${qaForm.callId.trim()}` : ''
    const qaNotes =
      qaForm.decision === 'Check Recording' && callIdNote
        ? `${trimmedNotes ? `${trimmedNotes}\n` : ''}${callIdNote}`
        : trimmedNotes
    setQaRecords((prev) => [
      ...prev,
      {
        id: uid('qa'),
        dateKey: todayKey,
        agentId,
        clientName: qaForm.clientName.trim(),
        decision: qaForm.decision as QaRecord['decision'],
        status: qaForm.decision === 'Good Sale' ? 'Good' : 'Check Recording',
        notes: qaNotes,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      },
    ])
    setQaForm({ agentId: '', clientName: '', decision: 'Good Sale', callId: '', notes: '' })
    setUiError(null)
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
        notes: '',
      },
    ])
    setAuditForm({ agentId: '', carrier: CARRIERS[0], clientName: '', reason: '', currentStatus: 'pending_cms' })
  }

  const handleSaveEodReport = (weekKey: string, reportText: string, houseSales: number, houseCpa: number | null): void => {
    setEodReports((prev) => [
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
        notes: '',
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

  const handleQaUpdate = (
    id: string,
    patch: Pick<QaRecord, 'agentId' | 'dateKey' | 'clientName' | 'decision' | 'status' | 'notes'>,
  ): void => {
    setQaRecords((prev) =>
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
  }

  const handleAuditUpdate = (
    id: string,
    patch: Partial<
      Pick<
        (typeof auditRecords)[number],
        'agentId' | 'discoveryTs' | 'carrier' | 'clientName' | 'currentStatus' | 'resolutionTs' | 'notes'
      >
    >,
  ): void => {
    const resolvedPatch =
      patch.currentStatus === 'accepted'
        ? { ...patch, resolutionTs: new Date().toISOString() }
        : patch
    setAuditRecords((prev) =>
      prev.map((record) =>
        record.id === id ? { ...record, ...resolvedPatch } : record,
      ),
    )
  }

  const handleAuditDelete = (id: string): void => {
    if (!window.confirm('Delete this audit record?')) return
    setAuditRecords((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSnapshotUpdate = (
    id: string,
    patch: Pick<(typeof snapshots)[number], 'billableCalls' | 'sales'>,
  ): void => {
    setSnapshots((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              billableCalls: patch.billableCalls,
              sales: patch.sales,
              updatedAt: new Date().toISOString(),
            }
          : row,
      ),
    )
  }

  const handleMeetingUpdate = (
    meetingId: string,
    patch: Pick<VaultMeeting, 'dateKey' | 'meetingType' | 'notes' | 'actionItems'>,
  ): void => {
    setVaultMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, ...patch } : m)),
    )
  }

  const setAttendancePercent = (agentId: string, dateKey: string, percent: AttendancePercent): void => {
    setAttendance((prev) => {
      const existing = prev.find((a) => a.agentId === agentId && a.dateKey === dateKey)
      if (!existing)
        return [...prev, { id: uid('att'), weekKey: selectedAttendanceWeekKey, dateKey, agentId, percent, notes: '' }]
      if (existing.percent !== percent) {
        const agentName = agents.find((a) => a.id === agentId)?.name ?? 'Agent'
        const proceed = window.confirm(
          `Attendance for ${agentName} on ${formatDateKey(dateKey)} already exists. Overwrite it?`,
        )
        if (!proceed) return prev
      }
      return prev.map((a) => (a.id === existing.id ? { ...a, percent } : a))
    })
  }

  const setSpiffAmount = (agentId: string, dateKey: string, amount: number): void => {
    const nextAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : 0
    setSpiffRecords((prev) => {
      const existing = prev.find((row) => row.agentId === agentId && row.dateKey === dateKey)
      if (!existing) {
        return [...prev, { id: uid('spiff'), weekKey: selectedAttendanceWeekKey, dateKey, agentId, amount: nextAmount }]
      }
      return prev.map((row) => (row.id === existing.id ? { ...row, amount: nextAmount } : row))
    })
  }

  const submitAttendanceDay = (dateKey: string): void => {
    const nowIso = new Date().toISOString()
    const nextSignature = buildAttendanceDaySignature(dateKey)
    const existing = attendanceSubmissions.find((submission) => submission.dateKey === dateKey)
    if (existing && existing.daySignature !== nextSignature) {
      const proceed = window.confirm(
        `Attendance for ${formatDateKey(dateKey)} was already submitted. Overwrite submission?`,
      )
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

  const addAttendanceNote = (agentId: string, dateKey: string, note: string): void => {
    const trimmedNote = note.trim()
    if (!trimmedNote) return
    setAttendance((prev) => {
      const existing = prev.find((a) => a.agentId === agentId && a.dateKey === dateKey)
      if (!existing)
        return [
          ...prev,
          {
            id: uid('att'),
            weekKey: selectedAttendanceWeekKey,
            dateKey,
            agentId,
            percent: 100,
            notes: trimmedNote,
          },
        ]
      return prev.map((a) => (a.id === existing.id ? { ...a, notes: trimmedNote } : a))
    })
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
        'id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs,notes',
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
            a.notes ?? '',
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
      'This will permanently clear all dashboard data (agents, attendance, spiff, snapshots, QA, audits, targets, vault). Continue?',
    )
    if (!proceed) return
    setAgents([])
    setQaRecords([])
    setAuditRecords([])
    setSnapshots([])
    void pushSnapshotsToApi([])
    setAttendance([])
    setSpiffRecords([])
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
        {topPage !== 'dashboard' && (
        <section className="panel page-head">
          <div className="page-head-copy">
            <p className="page-kicker">VC Dashboard</p>
            <h2>{pageMeta[topPage].title}</h2>
            <p className="page-subtext">{pageMeta[topPage].subtitle}</p>
          </div>
        </section>
        )}
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
            now={now}
            houseLive={houseLive}
            agentPerformanceRows={agentPerformanceRows}
            lastSnapshotLabel={lastSnapshotLabel}
            lastFetchedAt={lastFetchedAt}
            todaySnapshotCount={data.todaysSnapshots.length}
            floorCapacity={floorCapacity}
            weekTarget={weekTarget}
            weekTrend={weekTrend}
            actionQa={actionQa}
            actionAudit={actionAudit}
            attendanceAlert={attendanceAlert}
            onResolveQa={resolveQa}
            onToggleAuditFlag={toggleAuditFlag}
            onGoToAttendance={() => {
              setTopPage('tasks')
              setTaskPage('attendance')
            }}
            onRefreshData={() => void reload()}
          />
        )}

        {topPage === 'tasks' && (
          <TasksPage
            taskPage={taskPage}
            setTaskPage={setTaskPage}
            todayKey={todayKey}
            activeAgents={activeAgents}
            auditRecords={auditRecords}
            attendance={attendance}
            spiffRecords={spiffRecords}
            attendanceSubmissions={dataAttendanceSubmissions}
            currentWeekKey={currentWeekKey}
            selectedAttendanceWeekKey={selectedAttendanceWeekKey}
            setSelectedAttendanceWeekKey={setSelectedAttendanceWeekKey}
            attendanceWeekDates={attendanceWeekDates}
            attendanceWeekOptions={attendanceWeekOptions}
            weekTarget={weekTarget}
            qaForm={qaForm}
            setQaForm={setQaForm}
            auditForm={auditForm}
            setAuditForm={setAuditForm}
            incompleteQaAgentsToday={incompleteQaAgentsToday}
            incompleteAuditAgentsToday={incompleteAuditAgentsToday}
            lastPoliciesBotRun={store.lastPoliciesBotRun ?? null}
            onSetAttendancePercent={setAttendancePercent}
            onSetSpiffAmount={setSpiffAmount}
            onSubmitAttendanceDay={submitAttendanceDay}
            onAddAttendanceNote={addAttendanceNote}
            onSaveWeeklyTarget={saveWeeklyTarget}
            onQaSubmit={handleQaSubmit}
            onAuditSubmit={handleAuditSubmit}
            onAuditNoActionSubmit={handleAuditNoActionSubmit}
            onUpdateAuditRecord={handleAuditUpdate}
            onDeleteAuditRecord={handleAuditDelete}
            weekTrend={weekTrend}
            house6pmSnapshotForToday={house6pmSnapshotForToday}
            eodReports={eodReports}
            onSaveEodReport={handleSaveEodReport}
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
            kpiPeriod={kpiPeriod}
            setKpiPeriod={setKpiPeriod}
          />
        )}

        {topPage === 'eod' && (
          <EodPage
            selectedEodWeekKey={selectedEodWeekKey}
            setSelectedEodWeekKey={setSelectedEodWeekKey}
            eodWeekOptions={eodWeekOptions}
            eodWeeklyRows={eodWeeklyRows}
            eodWeeklySummary={eodWeeklySummary}
            monthLabel={monthLabel}
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
            vaultAttendanceHistory={vaultAttendanceHistory}
            vaultQaHistory={vaultQaHistory}
            vaultAuditHistory={vaultAuditHistory}
            weeklyTargetHistory={weeklyTargetHistory}
            snapshots={snapshots}
            lastPoliciesBotRun={store.lastPoliciesBotRun ?? null}
            onAddMeeting={addMeeting}
            onPdfUpload={handlePdfUpload}
            onUpdateQaRecord={handleQaUpdate}
            onUpdateAuditRecord={handleAuditUpdate}
            onDeleteAuditRecord={handleAuditDelete}
            onUpdateSnapshot={handleSnapshotUpdate}
            onUpdateMeeting={handleMeetingUpdate}
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
