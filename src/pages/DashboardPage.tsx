import { MetricCard } from '../components'
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
    <>
      {attendanceAlert && (
        <section className="alert-flash panel app-alert">
          <strong>Attendance Alert</strong>
          <p>Attendance is incomplete for today after 10:00 AM EST.</p>
        </section>
      )}
      {intraAlert && (
        <section className="alert-flash panel app-alert">
          <strong>Intra-Performance Alert</strong>
          <p>Intra-day performance is incomplete for: {overdueSlots.map((s) => s.label).join(', ')}.</p>
        </section>
      )}

      <section className="panel">
        <h2>House Pulse</h2>
        <div className="stats-grid">
          <MetricCard title="Total Sales" value={houseLive.totalSales} />
          <MetricCard title="Total Billable Calls" value={houseLive.totalCalls} />
          <MetricCard title="Total Marketing" value={`$${formatNum(houseLive.marketing, 0)}`} />
          <MetricCard title="Floor CPA" value={houseLive.cpa === null ? 'N/A' : `$${formatNum(houseLive.cpa)}`} />
          <MetricCard title="Floor CVR" value={houseLive.cvr === null ? 'N/A' : `${formatNum(houseLive.cvr * 100)}%`} />
          <MetricCard title="Floor Capacity (Mon-Fri)" value={formatNum(floorCapacity, 2)} />
        </div>
      </section>

      <section className="panel">
        <h2>Weekly Target Trend</h2>
        {weekTarget ? (
          <div className="trend-grid">
            <div className="trend-card">
              <p>Sales Goal</p>
              <strong>
                {weekTrend.totalSales} / {weekTarget.targetSales}
              </strong>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${weekTrend.salesProgress ?? 0}%` }} />
              </div>
              <p className="muted">
                {weekTrend.salesProgress !== null && weekTrend.salesProgress >= 100
                  ? 'Goal met or exceeded'
                  : 'Tracking toward weekly goal'}
              </p>
            </div>
            <div className="trend-card">
              <p>CPA Goal</p>
              <strong>
                Current: {weekTrend.currentCpa === null ? 'N/A' : `$${formatNum(weekTrend.currentCpa)}`} | Target: $
                {formatNum(weekTarget.targetCpa)}
              </strong>
              <div className="progress-track">
                <div
                  className={`progress-fill ${weekTrend.cpaDelta !== null && weekTrend.cpaDelta > 0 ? 'progress-over' : ''}`}
                  style={{
                    width:
                      weekTrend.currentCpa !== null && weekTrend.cpaTarget !== null && weekTrend.cpaTarget > 0
                        ? `${Math.min((weekTrend.currentCpa / weekTrend.cpaTarget) * 100, 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <p className="muted">
                {weekTrend.cpaDelta === null
                  ? 'Need sales data for CPA trend'
                  : weekTrend.cpaDelta <= 0
                    ? 'On or below target CPA'
                    : `Above target by $${formatNum(weekTrend.cpaDelta)}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted">No weekly target set yet. Set it in Tasks {'->'} Weekly Targets.</p>
        )}
      </section>

      <section className="panel">
        <h2>Action Center</h2>
        <div className="split">
          <div className="action-column">
            <h3>Check Recordings</h3>
            {actionQa.length === 0 && <p className="muted">N/A - no flagged QA items.</p>}
            {actionQa.map((q) => (
              <div key={q.id} className="alert-card">
                <p>
                  <strong>{agents.find((a) => a.id === q.agentId)?.name ?? 'Unknown Agent'}</strong> - {q.clientName}
                </p>
                <p className="muted">Notes: {q.notes || 'N/A'}</p>
                <button onClick={() => onResolveQa(q.id)}>Mark Resolved & Archive</button>
              </div>
            ))}
          </div>
          <div className="action-column">
            <h3>Action Needed (Audit)</h3>
            {actionAudit.length === 0 && <p className="muted">N/A - no active Action Needed items.</p>}
            {actionAudit.map((a) => {
              const ageHrs = (now.getTime() - new Date(a.discoveryTs).getTime()) / 3_600_000
              return (
                <div key={a.id} className={`alert-card ${ageHrs > 4 ? 'stale-alert' : ''}`}>
                  <p>
                    <strong>{agents.find((x) => x.id === a.agentId)?.name ?? 'Unknown Agent'}</strong> - {a.clientName}
                  </p>
                  <p className="muted">
                    {a.carrier} | {a.currentStatus} | discovered {formatTimestamp(a.discoveryTs)}
                  </p>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={a.mgmtNotified}
                      onChange={() => onToggleAuditFlag(a.id, 'mgmtNotified')}
                    />
                    Management Notified Agent
                  </label>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={a.outreachMade}
                      onChange={() => onToggleAuditFlag(a.id, 'outreachMade')}
                    />
                    Agent Attempted Outreach
                  </label>
                  <p className="muted">Timestamp 2: {formatTimestamp(a.resolutionTs)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Intra-Day Performance Entry</h2>
        <div className="table-wrap">
          <table>
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
                        <label className="tiny">
                          Calls
                          <input
                            type="number"
                            min={0}
                            value={calls}
                            onChange={(e) => onUpsertSnapshot(slot, agent.id, Number(e.target.value), sales)}
                          />
                        </label>
                        <label className="tiny">
                          Sales
                          <input
                            type="number"
                            min={0}
                            value={sales}
                            onChange={(e) => onUpsertSnapshot(slot, agent.id, calls, Number(e.target.value))}
                          />
                        </label>
                        <div className="muted tiny">CPA: {cpa === null ? 'N/A' : `$${formatNum(cpa)}`}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
