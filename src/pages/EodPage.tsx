import { useState } from 'react'
import { Button, Card, CardTitle, EodReportSection, type EodHistoryDay, Field, FieldLabel, Select } from '../components'
import type { PerfHistory } from '../types'
import { formatDateKey, formatNum, formatTimestamp, formatWeekRangeLabel } from '../utils'

type EodRow = {
  dayLabel: string
  dateKey: string
  deals: number
  marketing: number
  cpa: number | null
  updatedAt: string | null
}

type Props = {
  selectedEodWeekKey: string
  setSelectedEodWeekKey: (key: string) => void
  eodWeekOptions: Array<{ weekKey: string; label: string }>
  eodWeeklyRows: EodRow[]
  eodWeeklySummary: {
    deals: number
    marketing: number
    cpa: number | null
    updatedAt: string | null
    finalized: boolean
  }
  currentWeekKey: string
  todayKey: string
  eodTodayTotals: { sales: number; marketing: number; cpa: number | null }
  eodHistoryDays: EodHistoryDay[]
  agentPerformanceRows: Array<{
    agentId: string
    agentName: string
    calls: number
    sales: number
    marketing: number
    cpa: number | null
    cvr: number | null
  }>
  onSaveEodReport: (weekKey: string, reportText: string, houseSales: number, houseCpa: number | null) => void
  activeAgents: Array<{ id: string; name: string }>
  setPerfHistory: React.Dispatch<React.SetStateAction<PerfHistory[]>>
}

export function EodPage({
  selectedEodWeekKey,
  setSelectedEodWeekKey,
  eodWeekOptions,
  eodWeeklyRows,
  eodWeeklySummary,
  currentWeekKey,
  todayKey,
  eodTodayTotals,
  eodHistoryDays,
  agentPerformanceRows,
  onSaveEodReport,
  activeAgents,
  setPerfHistory,
}: Props) {
  const [expandedEodDateKey, setExpandedEodDateKey] = useState<string | null>(null)
  return (
    <div className="page-grid">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <CardTitle>Week of {formatWeekRangeLabel(selectedEodWeekKey)}</CardTitle>
          <Field className="w-full min-w-0 sm:min-w-[220px]">
            <FieldLabel>Week</FieldLabel>
            <Select value={selectedEodWeekKey} onChange={(e) => setSelectedEodWeekKey(e.target.value)}>
              {eodWeekOptions.map((option) => (
                <option key={option.weekKey} value={option.weekKey}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {eodWeeklyRows.map((row) => (
            <div key={row.dateKey} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
              <div className="mb-2 flex items-start justify-between border-b border-slate-200 pb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{row.dayLabel.slice(0, 3)}</p>
                  <p className="text-[11px] font-medium text-slate-500">{row.dateKey}</p>
                </div>
                <p className="text-xl font-semibold leading-none tabular-nums text-slate-900">{row.deals}</p>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-700">
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Deals</span>
                  <span className="tabular-nums text-sm font-semibold text-slate-900">{row.deals}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Mkt</span>
                  <span className="tabular-nums text-sm font-semibold text-slate-900">${formatNum(row.marketing, 0)}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">CPA</span>
                  <span className="tabular-nums text-sm font-semibold text-slate-900">
                    {row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}
                  </span>
                </p>
              </div>
              <div className="mt-2 border-t border-slate-200 pt-2 text-right">
                <Button type="button" variant="secondary" size="sm" onClick={() => setExpandedEodDateKey(row.dateKey)}>
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="w-full space-y-2 border-slate-200 shadow-sm">
        <CardTitle>EOW Summary</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Deals</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{eodWeeklySummary.deals}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Marketing</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">${formatNum(eodWeeklySummary.marketing, 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">CPA</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {eodWeeklySummary.cpa === null ? 'N/A' : `$${formatNum(eodWeeklySummary.cpa)}`}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {eodWeeklySummary.finalized
            ? `Summary last refreshed: ${formatTimestamp(eodWeeklySummary.updatedAt)}`
            : 'Weekly summary finalizes Friday at 6:15 PM and refreshes if new data is added after cutoff.'}
        </p>
      </Card>

      <EodReportSection
        currentWeekKey={currentWeekKey}
        todayKey={todayKey}
        eodTodayTotals={eodTodayTotals}
        eodHistoryDays={eodHistoryDays}
        onSaveEodReport={onSaveEodReport}
        activeAgents={activeAgents}
        setPerfHistory={setPerfHistory}
      />

      {expandedEodDateKey && (() => {
        const day = eodHistoryDays.find((d) => d.dateKey === expandedEodDateKey)
        const isToday = expandedEodDateKey === todayKey
        if (!day && !isToday) return null
        const displayRows = isToday ? agentPerformanceRows : (day?.agentRows ?? [])
        return (
          <div
            className="mobile-modal-scroll fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eod-week-open-title"
            onClick={() => setExpandedEodDateKey(null)}
          >
            <Card
              className="my-4 flex max-h-[90dvh] w-full min-w-0 max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <CardTitle id="eod-week-open-title" className="border-b border-slate-200 pb-3">
                EOD Report - {formatDateKey(expandedEodDateKey)}
              </CardTitle>
              <div className="mobile-modal-scroll flex-1 space-y-4 p-4">
                <div className="grid max-w-md gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">House Sales</p>
                    <p className="text-lg font-semibold text-slate-900">{day?.houseSales ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">House CPA</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {day?.houseCpa === null || day?.houseCpa === undefined ? 'N/A' : `$${formatNum(day.houseCpa)}`}
                    </p>
                  </div>
                </div>
                {day?.reportText ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Report</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{day.reportText}</p>
                  </div>
                ) : null}
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Agent performance</p>
                  {displayRows.length === 0 ? (
                    <p className="text-sm text-slate-500">No performance data for this day.</p>
                  ) : (
                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="p-2 font-medium text-slate-700">Agent</th>
                            <th className="p-2 font-medium text-slate-700 text-right">CPA</th>
                            <th className="p-2 font-medium text-slate-700 text-right">Sales</th>
                            <th className="p-2 font-medium text-slate-700 text-right">Calls</th>
                            <th className="p-2 font-medium text-slate-700 text-right">Marketing</th>
                            <th className="p-2 font-medium text-slate-700 text-right">CVR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row) => (
                            <tr key={row.agentId} className="border-b border-slate-100">
                              <td className="p-2 font-medium">{row.agentName}</td>
                              <td className="p-2 text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                              <td className="p-2 text-right tabular-nums">{row.sales}</td>
                              <td className="p-2 text-right tabular-nums">{row.calls}</td>
                              <td className="p-2 text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                              <td className="p-2 text-right tabular-nums">{row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <Button type="button" variant="secondary" onClick={() => setExpandedEodDateKey(null)}>
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )
      })()}
    </div>
  )
}
