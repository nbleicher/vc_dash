import { Card, CardTitle, DataTable, Field, FieldLabel, MetricCard, Select, TableWrap } from '../components'
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
    <Card className="space-y-4">
      <CardTitle>Metrics</CardTitle>
      <div className="row-wrap control-bar">
        <Field className="min-w-[220px]">
          <FieldLabel>Scope</FieldLabel>
          <Select value={metricsScope} onChange={(e) => setMetricsScope(e.target.value as MetricsScope)}>
            <option value="house">House (All Agents)</option>
            <option value="agent">Selected Agent</option>
          </Select>
        </Field>
        <Field className="min-w-[220px]">
          <FieldLabel>Agent</FieldLabel>
          <Select
            value={effectiveMetricsAgentId}
            onChange={(e) => setMetricsAgentId(e.target.value)}
            disabled={metricsScope === 'house'}
          >
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      <h3 className="mt-2">Agent Ranking</h3>
      <div className="row-wrap control-bar">
        <Field className="min-w-[180px]">
          <FieldLabel>Metric</FieldLabel>
          <Select value={rankMetric} onChange={(e) => setRankMetric(e.target.value as RankMetric)}>
            <option>Sales</option>
            <option>CPA</option>
            <option>CVR</option>
          </Select>
        </Field>
        <Field className="min-w-[180px]">
          <FieldLabel>Period</FieldLabel>
          <Select value={rankPeriod} onChange={(e) => setRankPeriod(e.target.value as RankPeriod)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </Select>
        </Field>
      </div>
      <TableWrap>
        <DataTable>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Agent</th>
              <th className="text-right">Sales</th>
              <th className="text-right">CPA</th>
              <th className="text-right">CVR</th>
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
                <td className="text-right tabular-nums">{row.sales}</td>
                <td className="text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                <td className="text-right tabular-nums">{row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrap>
    </Card>
  )
}
