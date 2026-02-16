import { Badge, Button, Card, CardTitle, DataTable, MetricCard, TableWrap } from '../components'
import { SLOT_CONFIG } from '../constants'
import type { DataStore } from '../data'
import { formatNum, formatTimestamp } from '../utils'

type Props = {
  agents: DataStore['agents']
  activeAgents: DataStore['agents']
  todayKey: string
  now: Date
  houseLive: { totalCalls: number; totalSales: number; marketing: number; cpa: number | null; cvr: number | null }
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
  intraAlert: boolean
  overdueSlots: Array<{ label: string }>
  snapshots: DataStore['snapshots']
  onResolveQa: (id: string) => void
  onToggleAuditFlag: (id: string, field: 'mgmtNotified' | 'outreachMade') => void
  onUpsertSnapshot: (
    slot: (typeof SLOT_CONFIG)[number],
    agentId: string,
    calls: number,
    sales: number
  ) => void
}

export function DashboardPage({
  agents,
  activeAgents,
  todayKey,
  now,
  houseLive,
  floorCapacity,
  weekTarget,
  weekTrend,
  actionQa,
  actionAudit,
  attendanceAlert,
  intraAlert,
  overdueSlots,
  snapshots,
  onResolveQa,
  onToggleAuditFlag,
  onUpsertSnapshot,
}: Props) {
  return (
    <div className="page-grid">
      {attendanceAlert && (
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <div className="flex items-center justify-between gap-3">
            <strong>Attendance Alert</strong>
            <Badge variant="warning">Needs Review</Badge>
          </div>
          <p>Attendance is incomplete for today after 10:00 AM EST.</p>
        </Card>
      )}
      {intraAlert && (
        <Card className="border-red-200 bg-red-50 text-red-900">
          <div className="flex items-center justify-between gap-3">
            <strong>Intra-Performance Alert</strong>
            <Badge variant="danger">Critical</Badge>
          </div>
          <p>Intra-day performance is incomplete for: {overdueSlots.map((s) => s.label).join(', ')}.</p>
        </Card>
      )}

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
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3>Check Recordings</h3>
              <Badge variant="warning">Needs Review</Badge>
            </div>
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
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3>Action Needed (Audit)</h3>
              <Badge variant="danger">Critical</Badge>
            </div>
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
      </Card>

      <Card className="space-y-4">
        <CardTitle>Intra-Day Performance Entry</CardTitle>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Agent</th>
                {SLOT_CONFIG.map((slot) => (
                  <th key={slot.key}>{slot.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeAgents.length === 0 && (
                <tr>
                  <td colSpan={SLOT_CONFIG.length + 1}>N/A - no active agents.</td>
                </tr>
              )}
              {activeAgents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.name}</td>
                  {SLOT_CONFIG.map((slot) => {
                    const snap =
                      snapshots.find(
                        (s) => s.dateKey === todayKey && s.slot === slot.key && s.agentId === agent.id
                      ) ?? null
                    const calls = snap?.billableCalls ?? 0
                    const sales = snap?.sales ?? 0
                    const cpa = sales > 0 ? (calls * 15) / sales : null
                    const cellClass =
                      cpa !== null && cpa > 190 ? 'heat-red' : cpa !== null && cpa > 130 ? 'heat-yellow' : ''
                    return (
                      <td key={slot.key} className={cellClass}>
                        <label className="text-xs font-medium text-slate-600">
                          Calls
                          <input
                            className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
                            type="number"
                            min={0}
                            value={calls}
                            onChange={(e) => onUpsertSnapshot(slot, agent.id, Number(e.target.value), sales)}
                          />
                        </label>
                        <label className="mt-2 block text-xs font-medium text-slate-600">
                          Sales
                          <input
                            className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
                            type="number"
                            min={0}
                            value={sales}
                            onChange={(e) => onUpsertSnapshot(slot, agent.id, calls, Number(e.target.value))}
                          />
                        </label>
                        <div className="mt-1 text-xs text-slate-500">CPA: {cpa === null ? 'N/A' : `$${formatNum(cpa)}`}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      </Card>
    </div>
  )
}
