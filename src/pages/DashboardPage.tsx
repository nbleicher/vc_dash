import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardTitle, MetricCard } from '../components'
import type { DataStore } from '../data'
import { formatNum, formatTimestamp } from '../utils'

const CPA_HIGHLIGHT_THRESHOLD = 130

type AgentPerformanceRow = {
  agentId: string
  agentName: string
  calls: number
  sales: number
  marketing: number
  cpa: number | null
  cvr: number | null
}

type Props = {
  agents: DataStore['agents']
  now: Date
  houseLive: { totalCalls: number; totalSales: number; marketing: number; cpa: number | null; cvr: number | null }
  agentPerformanceRows: AgentPerformanceRow[]
  lastSnapshotLabel: string
  lastFetchedAt: string | null
  todaySnapshotCount: number
  floorCapacity: number
  weekTarget: { targetSales: number; targetCpa: number } | null
  weekTrend: {
    totalSales: number
    currentCpa: number | null
    salesProgress: number | null
    cpaTarget: number | null
    cpaDelta: number | null
  }
  actionQa: Array<{ id: string; agentId: string; clientName: string; notes: string }>
  actionAudit: Array<{
    id: string
    agentId: string
    clientName: string
    carrier: string
    currentStatus: string
    discoveryTs: string
    mgmtNotified: boolean
    outreachMade: boolean
    resolutionTs: string | null
  }>
  attendanceAlert: boolean
  onResolveQa: (id: string) => void
  onToggleAuditFlag: (id: string, field: 'mgmtNotified' | 'outreachMade') => void
  onGoToAttendance: () => void
  onRefreshData: () => void
}

export function DashboardPage({
  agents,
  now,
  houseLive,
  agentPerformanceRows,
  lastSnapshotLabel,
  lastFetchedAt,
  todaySnapshotCount,
  floorCapacity,
  weekTarget,
  weekTrend,
  actionQa,
  actionAudit,
  attendanceAlert,
  onResolveQa,
  onToggleAuditFlag,
  onGoToAttendance,
  onRefreshData,
}: Props) {
  const cpaCardToneClass =
    weekTrend.cpaDelta === null
      ? 'border-slate-200 bg-slate-50'
      : weekTrend.cpaDelta <= 0
        ? 'border-green-200 bg-green-50/70'
        : 'border-red-200 bg-red-50/70'

  const [sortBy, setSortBy] = useState<'cpa' | 'sales'>('cpa')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const displayedRows = useMemo(() => {
    const rows = [...agentPerformanceRows]
    if (sortBy === 'cpa') {
      rows.sort((a, b) => {
        const va = a.cpa ?? -Infinity
        const vb = b.cpa ?? -Infinity
        return sortDir === 'desc' ? vb - va : va - vb
      })
    } else {
      rows.sort((a, b) => (sortDir === 'desc' ? b.sales - a.sales : a.sales - b.sales))
    }
    return rows
  }, [agentPerformanceRows, sortBy, sortDir])

  return (
    <div className="page-grid">
      {attendanceAlert && (
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <div className="flex items-center justify-between gap-3">
            <strong>Attendance Alert</strong>
            <Badge variant="warning">Needs Review</Badge>
          </div>
          <p>Attendance is incomplete for today after 5:30 PM EST.</p>
          <Button variant="default" className="mt-2" onClick={onGoToAttendance}>
            Complete Attendance
          </Button>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-1">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Agent Performance</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Data: {lastSnapshotLabel}</span>
            {todaySnapshotCount > 0 && (
              <span className="text-xs text-slate-400">({todaySnapshotCount} snapshots for today)</span>
            )}
            {lastFetchedAt != null && (
              <span className="text-xs text-slate-400">Fetched: {formatTimestamp(lastFetchedAt)}</span>
            )}
            <Button variant="secondary" className="text-xs px-2 py-1.5 h-auto" onClick={onRefreshData}>
              Refresh
            </Button>
          </div>
        </div>
        {agentPerformanceRows.length === 0 ? (
          <p className="text-sm text-slate-500">No active agents.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Sort by
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'cpa' | 'sales')}
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="cpa">CPA</option>
                  <option value="sales">Sales</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Order
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="desc">Descending (high first)</option>
                  <option value="asc">Ascending (low first)</option>
                </select>
              </label>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[300px] rounded border border-slate-200">
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
                  {displayedRows.map((row) => {
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
      </Card>
        </div>
        <div className="flex flex-col gap-5 xl:col-span-2">
      <Card className="space-y-4">
        <CardTitle>House Pulse</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard title="Total Sales" value={houseLive.totalSales} />
          <MetricCard title="Total Billable Calls" value={houseLive.totalCalls} />
          <MetricCard title="Total Marketing" value={`$${formatNum(houseLive.marketing, 0)}`} />
          <MetricCard title="Floor CPA" value={houseLive.cpa === null ? 'N/A' : `$${formatNum(houseLive.cpa)}`} />
          <MetricCard title="Floor CVR" value={houseLive.cvr === null ? 'N/A' : `${formatNum(houseLive.cvr * 100)}%`} />
          <MetricCard title="Floor Capacity (Mon-Fri)" value={formatNum(floorCapacity, 2)} />
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Weekly Target Trend</CardTitle>
        {weekTarget ? (
          <div className="split">
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p>Sales Goal</p>
              <strong className="text-lg text-slate-900">
                {weekTrend.totalSales} / {weekTarget.targetSales}
              </strong>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-primary" style={{ width: `${weekTrend.salesProgress ?? 0}%` }} />
              </div>
              <p className="text-sm text-slate-500">
                {weekTrend.salesProgress !== null && weekTrend.salesProgress >= 100
                  ? 'Goal met or exceeded'
                  : 'Tracking toward weekly goal'}
              </p>
            </div>
            <div className={`space-y-2 rounded-xl border p-4 ${cpaCardToneClass}`}>
              <p>CPA Goal</p>
              <strong className="text-lg text-slate-900">
                Current: {weekTrend.currentCpa === null ? 'N/A' : `$${formatNum(weekTrend.currentCpa)}`} | Target: $
                {formatNum(weekTarget.targetCpa)}
              </strong>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full ${weekTrend.cpaDelta !== null && weekTrend.cpaDelta > 0 ? 'bg-red-500' : 'bg-primary'}`}
                  style={{
                    width:
                      weekTrend.currentCpa !== null && weekTrend.cpaTarget !== null && weekTrend.cpaTarget > 0
                        ? `${Math.min((weekTrend.currentCpa / weekTrend.cpaTarget) * 100, 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {weekTrend.cpaDelta === null
                  ? 'Need sales data for CPA trend'
                  : weekTrend.cpaDelta <= 0
                    ? 'On or below target CPA'
                    : `Above target by $${formatNum(weekTrend.cpaDelta)}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No weekly target set yet. Set it in Tasks {'->'} Weekly Targets.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <CardTitle>Action Center</CardTitle>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <h3>Check Recordings</h3>
              <Badge variant="warning">Needs Review</Badge>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto max-h-[55rem] space-y-3">
              {actionQa.length === 0 && <p className="text-sm text-slate-500">N/A - no flagged QA items.</p>}
              {actionQa.map((q) => (
                <div key={q.id} className="alert-card">
                  <p>
                    <strong>{agents.find((a) => a.id === q.agentId)?.name ?? 'Unknown Agent'}</strong> - {q.clientName}
                  </p>
                  <p className="text-sm text-slate-500">Notes: {q.notes || 'N/A'}</p>
                  <Button onClick={() => onResolveQa(q.id)} className="mt-2" variant="default">
                    Mark Resolved & Archive
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <h3>Action Needed (Audit)</h3>
              <Badge variant="danger">Critical</Badge>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto max-h-[55rem] space-y-3">
              {actionAudit.length === 0 && <p className="text-sm text-slate-500">N/A - no active Action Needed items.</p>}
              {actionAudit.map((a) => {
                const ageHrs = (now.getTime() - new Date(a.discoveryTs).getTime()) / 3_600_000
                return (
                  <div key={a.id} className={`alert-card ${ageHrs > 4 ? 'stale-alert' : ''}`}>
                    <p>
                      <strong>{agents.find((x) => x.id === a.agentId)?.name ?? 'Unknown Agent'}</strong> - {a.clientName}
                    </p>
                    <p className="status-text">
                      {a.carrier} | {a.currentStatus} | discovered {formatTimestamp(a.discoveryTs)}
                    </p>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={a.mgmtNotified}
                        onChange={() => onToggleAuditFlag(a.id, 'mgmtNotified')}
                      />
                      Management Notified Agent
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={a.outreachMade}
                        onChange={() => onToggleAuditFlag(a.id, 'outreachMade')}
                      />
                      Agent Attempted Outreach
                    </label>
                    <p className="text-sm text-slate-500">Timestamp 2: {formatTimestamp(a.resolutionTs)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
        </div>
      </div>
    </div>
  )
}
