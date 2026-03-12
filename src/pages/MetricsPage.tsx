import { useMemo, useState } from 'react'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, MetricCard, Select, TableWrap } from '../components'
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
  activeAuditCount: number
  rankRows: Array<{ agentId: string; agentName: string; sales: number; cpa: number | null; cvr: number | null }>
  rankRowsTransferAdjusted: Array<{ agentId: string; agentName: string; sales: number; cpa: number | null; cvr: number | null }>
  rankMetric: RankMetric
  setRankMetric: (m: RankMetric) => void
  kpiPeriod: RankPeriod
  setKpiPeriod: (p: RankPeriod) => void
  metricsDateStart: string | null
  metricsDateEnd: string | null
  setMetricsDateStart: (s: string | null) => void
  setMetricsDateEnd: (s: string | null) => void
  metricsScopeDataCustom?: { sales: number; cpa: number | null; cvr: number | null }
}

export function MetricsPage({
  metricsScope,
  setMetricsScope,
  setMetricsAgentId,
  effectiveMetricsAgentId,
  activeAgents,
  metricsScopeData,
  activeAuditCount,
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
  metricsScopeDataCustom,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarStart, setCalendarStart] = useState(metricsDateStart ?? '')
  const [calendarEnd, setCalendarEnd] = useState(metricsDateEnd ?? '')
  const scopeValue = metricsScope === 'house' ? '__house__' : effectiveMetricsAgentId
  const hasCustomRange = Boolean(metricsDateStart && metricsDateEnd && metricsDateStart !== metricsDateEnd)
  const selectedPeriodMetrics = useMemo(() => {
    if (hasCustomRange && metricsScopeDataCustom) return metricsScopeDataCustom
    if (kpiPeriod === 'day') return metricsScopeData.daily
    if (kpiPeriod === 'week') return metricsScopeData.weekly
    return metricsScopeData.monthly
  }, [hasCustomRange, metricsScopeDataCustom, kpiPeriod, metricsScopeData.daily, metricsScopeData.monthly, metricsScopeData.weekly])
  const periodLabel = hasCustomRange
    ? 'Custom range'
    : kpiPeriod === 'day'
      ? 'Daily'
      : kpiPeriod === 'week'
        ? 'Weekly'
        : 'Monthly'

  return (
    <>
      <Card className="space-y-4">
        <CardTitle>Metrics</CardTitle>
        <div className="row-wrap control-bar">
          <Field className="min-w-[260px]">
            <FieldLabel>Scope</FieldLabel>
            <Select
              value={scopeValue}
              onChange={(e) => {
                const next = e.target.value
                if (next === '__house__') {
                  setMetricsScope('house')
                  return
                }
                setMetricsScope('agent')
                setMetricsAgentId(next)
              }}
            >
              <option value="__house__">House (All Agents)</option>
              {activeAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="min-w-[180px]">
            <FieldLabel>KPI Period</FieldLabel>
            <Select
              value={hasCustomRange ? 'custom' : kpiPeriod}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'custom') return
                setKpiPeriod(v as 'day' | 'week' | 'month')
              }}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              {hasCustomRange && <option value="custom">Custom range</option>}
            </Select>
          </Field>
          <Field className="relative">
            <FieldLabel>Date / Range</FieldLabel>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCalendarOpen((o) => !o)
                  if (!calendarOpen) {
                    setCalendarStart(metricsDateStart ?? '')
                    setCalendarEnd(metricsDateEnd ?? '')
                  }
                }}
              >
                Calendar
              </Button>
              {(metricsDateStart || metricsDateEnd) && (
                <span className="text-sm text-slate-600">
                  {metricsDateStart}
                  {hasCustomRange ? ` – ${metricsDateEnd}` : ''}
                </span>
              )}
            </div>
            {calendarOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <div className="space-y-2">
                  <Field>
                    <FieldLabel>Start date</FieldLabel>
                    <input
                      type="date"
                      value={calendarStart}
                      onChange={(e) => setCalendarStart(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>End date (optional, for range)</FieldLabel>
                    <input
                      type="date"
                      value={calendarEnd}
                      onChange={(e) => setCalendarEnd(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => {
                        if (calendarStart) {
                          setMetricsDateStart(calendarStart)
                          setMetricsDateEnd(calendarEnd && calendarEnd !== calendarStart ? calendarEnd : null)
                          setCalendarOpen(false)
                        }
                      }}
                    >
                      Apply
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setMetricsDateStart(null)
                        setMetricsDateEnd(null)
                        setCalendarStart('')
                        setCalendarEnd('')
                        setCalendarOpen(false)
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title={`${periodLabel} Sales`} value={selectedPeriodMetrics.sales} />
          <MetricCard
            title={`${periodLabel} CPA`}
            value={selectedPeriodMetrics.cpa === null ? 'N/A' : `$${formatNum(selectedPeriodMetrics.cpa)}`}
          />
          <MetricCard title={`${periodLabel} CVR`} value={selectedPeriodMetrics.cvr === null ? 'N/A' : `${formatNum(selectedPeriodMetrics.cvr * 100)}%`} />
          <MetricCard title="Active Action Needed" value={activeAuditCount} />
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Agent Ranking</CardTitle>
        <div className="row-wrap control-bar">
          <Field className="min-w-[180px]">
            <FieldLabel>Metric</FieldLabel>
            <Select value={rankMetric} onChange={(e) => setRankMetric(e.target.value as RankMetric)}>
              <option>Sales</option>
              <option>CPA</option>
              <option>CVR</option>
            </Select>
          </Field>
          <p className="text-sm text-slate-500">
            Rankings use the same date or range selected in the Metrics calendar above.
          </p>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Standard</h3>
            <TableWrap>
              <DataTable className="w-auto min-w-[640px] max-w-[900px] mx-auto">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left border-b border-slate-200">Rank</th>
                    <th className="px-2 py-1 text-left border-b border-slate-200">Agent</th>
                    <th className="px-2 py-1 text-right border-b border-slate-200">Sales</th>
                    <th className="px-2 py-1 text-right border-b border-slate-200">CPA</th>
                    <th className="px-2 py-1 text-right border-b border-slate-200">CVR</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(even)]:bg-transparent">
                  {rankRows.length === 0 && (
                    <tr>
                      <td colSpan={5}>N/A</td>
                    </tr>
                  )}
                  {rankRows.map((row, idx) => (
                    <tr key={row.agentId}>
                      <td className="px-2 py-1">{idx + 1}</td>
                      <td className="px-2 py-1">{row.agentName}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.sales}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Agent Ranking (transfer adjusted)</h3>
            <TableWrap>
              <DataTable className="w-auto min-w-[640px] max-w-[900px] mx-auto">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left border-b border-slate-200">Rank</th>
                    <th className="px-2 py-1 text-left border-b border-slate-200">Agent</th>
                    <th className="px-2 py-1 text-right border-b border-slate-200">Sales</th>
                    <th className="px-2 py-1 text-right border-b border-slate-200">CPA</th>
                    <th className="px-2 py-1 text-right border-b border-slate-200">CVR</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(even)]:bg-transparent">
                  {rankRowsTransferAdjusted.length === 0 && (
                    <tr>
                      <td colSpan={5}>N/A</td>
                    </tr>
                  )}
                  {rankRowsTransferAdjusted.map((row, idx) => (
                    <tr key={row.agentId}>
                      <td className="px-2 py-1">{idx + 1}</td>
                      <td className="px-2 py-1">{row.agentName}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.sales}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </div>
        </div>
      </Card>
    </>
  )
}
