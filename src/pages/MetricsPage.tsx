import { MetricCard } from '../components'
import type { MetricsScope, RankMetric, RankPeriod } from '../types'
import { formatNum } from '../utils'

type Props = {
  metricsScope: MetricsScope
  setMetricsScope: (s: MetricsScope) => void
  setMetricsAgentId: (s: string) => void
  effectiveMetricsAgentId: string
  activeAgents: Array<{ id: string; name: string }>
  metricsScopeData: {
    daily: { sales: number; cpa: number | null; cvr: number | null }
    weekly: { sales: number; cpa: number | null; cvr: number | null }
    monthly: { sales: number; cpa: number | null; cvr: number | null }
  }
  qaPassRate: number | null
  auditRecoveryHours: number | null
  activeAuditCount: number
  rankRows: Array<{ agentName: string; sales: number; cpa: number | null; cvr: number | null }>
  rankMetric: RankMetric
  setRankMetric: (m: RankMetric) => void
  rankPeriod: RankPeriod
  setRankPeriod: (p: RankPeriod) => void
}

export function MetricsPage({
  metricsScope,
  setMetricsScope,
  setMetricsAgentId,
  effectiveMetricsAgentId,
  activeAgents,
  metricsScopeData,
  qaPassRate,
  auditRecoveryHours,
  activeAuditCount,
  rankRows,
  rankMetric,
  setRankMetric,
  rankPeriod,
  setRankPeriod,
}: Props) {
  return (
    <section className="panel">
      <h2>Metrics</h2>
      <div className="row gap-sm vault-controls">
        <label>
          Scope
          <select value={metricsScope} onChange={(e) => setMetricsScope(e.target.value as MetricsScope)}>
            <option value="house">House (All Agents)</option>
            <option value="agent">Selected Agent</option>
          </select>
        </label>
        <label>
          Agent
          <select
            value={effectiveMetricsAgentId}
            onChange={(e) => setMetricsAgentId(e.target.value)}
            disabled={metricsScope === 'house'}
          >
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats-grid">
        <MetricCard title="Daily Sales" value={metricsScopeData.daily.sales} />
        <MetricCard
          title="Daily CPA"
          value={metricsScopeData.daily.cpa === null ? 'N/A' : `$${formatNum(metricsScopeData.daily.cpa)}`}
        />
        <MetricCard title="Weekly Sales" value={metricsScopeData.weekly.sales} />
        <MetricCard
          title="Weekly CPA"
          value={metricsScopeData.weekly.cpa === null ? 'N/A' : `$${formatNum(metricsScopeData.weekly.cpa)}`}
        />
        <MetricCard title="Monthly Sales" value={metricsScopeData.monthly.sales} />
        <MetricCard
          title="Monthly CVR"
          value={
            metricsScopeData.monthly.cvr === null ? 'N/A' : `${formatNum(metricsScopeData.monthly.cvr * 100)}%`
          }
        />
        <MetricCard
          title="QA Pass Rate"
          value={qaPassRate === null ? 'N/A' : `${formatNum(qaPassRate * 100)}%`}
        />
        <MetricCard
          title="Audit Recovery (hrs)"
          value={auditRecoveryHours === null ? 'N/A' : formatNum(auditRecoveryHours)}
        />
        <MetricCard title="Active Action Needed" value={activeAuditCount} />
      </div>

      <h3>Agent Ranking</h3>
      <div className="row gap-sm">
        <label>
          Metric
          <select value={rankMetric} onChange={(e) => setRankMetric(e.target.value as RankMetric)}>
            <option>Sales</option>
            <option>CPA</option>
            <option>CVR</option>
          </select>
        </label>
        <label>
          Period
          <select value={rankPeriod} onChange={(e) => setRankPeriod(e.target.value as RankPeriod)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Agent</th>
              <th>Sales</th>
              <th>CPA</th>
              <th>CVR</th>
            </tr>
          </thead>
          <tbody>
            {rankRows.length === 0 && (
              <tr>
                <td colSpan={5}>N/A</td>
              </tr>
            )}
            {rankRows.map((row, idx) => (
              <tr key={row.agentName}>
                <td>{idx + 1}</td>
                <td>{row.agentName}</td>
                <td>{row.sales}</td>
                <td>{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                <td>{row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
