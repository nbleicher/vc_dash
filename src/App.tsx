import { useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Card, TopNav } from './components'
import { useDataStore } from './data'
import { useAppData, useSettingsActions, useTaskActions, useVaultActions } from './hooks'
import type { QaFormState } from './hooks'
import type { ExportFlags, ShadowLog, TopPage, VaultMeeting } from './types'
import { estDateKey, uid } from './utils'
import {
  DashboardPage,
  AgentPage,
  EodPage,
  MetricsPage,
  SettingsPage,
  TasksPage,
  VaultPage,
} from './pages'

function pathToTopPage(path: string): TopPage | null {
  if (path === '/' || path === '/dashboard') return 'dashboard'
  if (path === '/agent') return 'agent'
  if (path === '/tasks') return 'tasks'
  if (path === '/metrics') return 'metrics'
  if (path === '/eod') return 'eod'
  if (path === '/vault') return 'vault'
  if (path === '/settings') return 'settings'
  return null
}

function App() {
  const store = useDataStore()
  const data = useAppData(store)
  const {
    agents,
    setAgents,
    qaRecords,
    auditRecords,
    spiffRecords,
    setPerfHistory,
    vaultMeetings,
    vaultDocs,
    transfers,
    setShadowLogs,
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
    incompleteAuditAgentsToday,
    floorCapacity,
    weekTarget,
    weekTrend,
    taskPage,
    setTaskPage,
    selectedEodWeekKey,
    setSelectedEodWeekKey,
    eodWeekOptions,
    selectedAgentWeekKey,
    setSelectedAgentWeekKey,
    agentPageAgentId,
    setAgentPageAgentId,
    agentWeekRows,
    shadowLogsByDateForAgent,
    eodWeeklyRows,
    eodWeeklySummary,
    eodTodayTotals,
    eodHistoryDays,
    monthLabel,
    metricsScope,
    setMetricsScope,
    setMetricsAgentId,
    effectiveMetricsAgentId,
    metricsScopeData,
    rankRows,
    rankRowsTransferAdjusted,
    rankMetric,
    setRankMetric,
    kpiPeriod,
    setKpiPeriod,
    metricsDateStart,
    metricsDateEnd,
    setMetricsDateStart,
    setMetricsDateEnd,
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
  } = data

  const location = useLocation()
  const topPage = pathToTopPage(location.pathname)

  const [newAgent, setNewAgent] = useState('')
  const [qaForm, setQaForm] = useState<QaFormState>({
    dateKey: estDateKey(new Date()),
    agentId: '',
    clientName: '',
    decision: 'Good Sale',
    callId: '',
    notes: '',
  })
  const [auditForm, setAuditForm] = useState<{ agentId: string }>({ agentId: '' })
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

  const [uiError, setUiError] = useState<string | null>(null)

  const { runExport, clearHistory } = useSettingsActions(store, exportFlags, todayKey, setUiError)
  const taskActions = useTaskActions(
    store,
    { todayKey, currentWeekKey, selectedAttendanceWeekKey, activeAgents },
    qaForm,
    setQaForm,
    auditForm,
    setAuditForm,
    setUiError,
  )
  const vaultActions = useVaultActions(
    store,
    { selectedVaultAgent, snapshots },
    meetingForm,
    setMeetingForm,
    setUiError,
  )
  const pageMeta: Record<TopPage, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Monitor floor performance, alerts, and intra-day activity.' },
    agent: { title: 'Agent', subtitle: 'Track weekly KPIs, shadow calls, and ranking for a selected agent.' },
    tasks: { title: 'Tasks', subtitle: 'Manage attendance, QA, audits, and weekly targets.' },
    metrics: { title: 'Metrics', subtitle: 'Track KPIs and ranking trends across house and agent scope.' },
    eod: { title: 'EOD', subtitle: 'Review weekly totals and end-of-week house summary snapshots.' },
    vault: { title: 'Vault', subtitle: 'Review history, coaching notes, and document records.' },
    settings: { title: 'Settings', subtitle: 'Maintain agents and export operational data.' },
  }

  const incompleteQaAgentsForSelectedDate = useMemo(() => {
    const completed = new Set(qaRecords.filter((r) => r.dateKey === qaForm.dateKey).map((r) => r.agentId))
    return activeAgents.filter((agent) => !completed.has(agent.id))
  }, [activeAgents, qaRecords, qaForm.dateKey])

  const handleAddAgent = (e: React.FormEvent): void => {
    e.preventDefault()
    const name = newAgent.trim()
    if (!name) return
    setAgents((prev) => [...prev, { id: uid('agent'), name, active: true, createdAt: new Date().toISOString() }])
    setNewAgent('')
  }
  const handleStartShadow = (managerName: string): void => {
    const name = managerName.trim()
    if (!name || !agentPageAgentId) return
    const nowTs = new Date().toISOString()
    setShadowLogs((prev) => {
      const alreadyActive = prev.some((row) => row.agentId === agentPageAgentId && row.dateKey === todayKey && row.endedAt === null)
      if (alreadyActive) return prev
      const next: ShadowLog = {
        id: uid('shadow'),
        agentId: agentPageAgentId,
        managerName: name,
        dateKey: todayKey,
        startedAt: nowTs,
        endedAt: null,
        calls: [],
        createdAt: nowTs,
        updatedAt: nowTs,
      }
      return [...prev, next]
    })
  }
  const handleAddShadowCall = (): void => {
    setShadowLogs((prev) =>
      prev.map((row) => {
        if (row.agentId !== agentPageAgentId || row.dateKey !== todayKey || row.endedAt !== null) return row
        return {
          ...row,
          calls: [...row.calls, { id: uid('shadow_call'), notes: '', coaching: '', durationMinutes: null, sale: false }],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }
  const handleUpdateShadowCall = (
    logId: string,
    callId: string,
    patch: Partial<{ notes: string; coaching: string; durationMinutes: number | null; sale: boolean }>,
  ): void => {
    setShadowLogs((prev) =>
      prev.map((row) => {
        if (row.id !== logId) return row
        return {
          ...row,
          calls: row.calls.map((call) => (call.id === callId ? { ...call, ...patch } : call)),
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }
  const handleEndShadow = (): void => {
    setShadowLogs((prev) =>
      prev.map((row) =>
        row.agentId === agentPageAgentId && row.dateKey === todayKey && row.endedAt === null
          ? { ...row, endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : row,
      ),
    )
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

  if (location.pathname === '/') {
    return <Navigate to="/dashboard" replace />
  }
  if (topPage === null) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen min-h-dvh min-w-0 overflow-x-hidden">
      <div className="mx-auto max-w-[1480px] p-4 md:p-6">
      <header className="panel top-shell">
        <div className="top-shell-nav">
          <TopNav />
        </div>
        <div className="top-shell-actions">
          <Button variant="danger" className="min-h-[44px]" onClick={() => void logout()}>
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
            onResolveQa={taskActions.resolveQa}
            onToggleAuditFlag={taskActions.toggleAuditFlag}
            onRefreshData={() => void reload()}
          />
        )}
        {topPage === 'agent' && (
          <AgentPage
            activeAgents={activeAgents}
            agentPageAgentId={agentPageAgentId}
            setAgentPageAgentId={setAgentPageAgentId}
            selectedAgentWeekKey={selectedAgentWeekKey}
            setSelectedAgentWeekKey={setSelectedAgentWeekKey}
            eodWeekOptions={eodWeekOptions}
            agentWeekRows={agentWeekRows}
            shadowLogsByDateForAgent={shadowLogsByDateForAgent}
            onStartShadow={handleStartShadow}
            onAddCall={handleAddShadowCall}
            onEndShadow={handleEndShadow}
            onUpdateShadowCall={handleUpdateShadowCall}
            todayKey={todayKey}
          />
        )}

        {topPage === 'tasks' && (
          <TasksPage
            taskPage={taskPage}
            setTaskPage={setTaskPage}
            activeAgents={activeAgents}
            auditRecords={auditRecords}
            spiffRecords={spiffRecords}
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
            incompleteQaAgentsForSelectedDate={incompleteQaAgentsForSelectedDate}
            todayKey={todayKey}
            incompleteAuditAgentsToday={incompleteAuditAgentsToday}
            lastPoliciesBotRun={store.lastPoliciesBotRun ?? null}
            onSetSpiffAmount={taskActions.setSpiffAmount}
            onSaveWeeklyTarget={taskActions.saveWeeklyTarget}
            onQaSubmit={taskActions.handleQaSubmit}
            onAuditNoActionSubmit={taskActions.handleAuditNoActionSubmit}
            onUpdateAuditRecord={taskActions.handleAuditUpdate}
            onDeleteAuditRecord={taskActions.handleAuditDelete}
            transfers={transfers}
            onAddTransfer={taskActions.handleAddTransfer}
            onDeleteTransfer={taskActions.handleDeleteTransfer}
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
            metricsScopeDataCustom={metricsScopeData.custom}
            activeAuditCount={activeAuditCount}
            rankRows={rankRows}
            rankRowsTransferAdjusted={rankRowsTransferAdjusted}
            rankMetric={rankMetric}
            setRankMetric={setRankMetric}
            kpiPeriod={kpiPeriod}
            setKpiPeriod={setKpiPeriod}
            metricsDateStart={metricsDateStart}
            metricsDateEnd={metricsDateEnd}
            setMetricsDateStart={setMetricsDateStart}
            setMetricsDateEnd={setMetricsDateEnd}
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
            currentWeekKey={currentWeekKey}
            todayKey={todayKey}
            eodTodayTotals={eodTodayTotals}
            eodHistoryDays={eodHistoryDays}
            onSaveEodReport={taskActions.handleSaveEodReport}
            agentPerformanceRows={agentPerformanceRows}
            lastSnapshotLabel={lastSnapshotLabel}
            activeAgents={activeAgents}
            setPerfHistory={setPerfHistory}
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
            onAddMeeting={vaultActions.addMeeting}
            onPdfUpload={vaultActions.handlePdfUpload}
            onUpdateQaRecord={taskActions.handleQaUpdate}
            onUpdateAuditRecord={taskActions.handleAuditUpdate}
            onDeleteAuditRecord={taskActions.handleAuditDelete}
            onUpdateSnapshot={vaultActions.handleSnapshotUpdate}
            onUpdateMeeting={vaultActions.handleMeetingUpdate}
            transfers={transfers}
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
    </div>
  )
}

export default App
