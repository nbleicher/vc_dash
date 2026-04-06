import { useState } from 'react'
import { Button, Card, CardTitle, DataTable, EodReportSection, type EodHistoryDay, Field, FieldLabel, Select, TableWrap } from '../components'
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
  monthLabel: string
  currentWeekKey: string
  todayKey: string
  eodTodayTotals: { sales: number; marketing: number; cpa: number | null }
  eodHistoryDays: EodHistoryDay[]
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
  monthLabel,
  currentWeekKey,
  todayKey,
  eodTodayTotals,
  eodHistoryDays,
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
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Day</th>
                <th className="text-right">Total Deals</th>
                <th className="text-right">Total Marketing</th>
                <th className="text-right">CPA</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {eodWeeklyRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dayLabel}</td>
                  <td className="text-right tabular-nums">{row.deals}</td>
                  <td className="text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                  <td className="text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                  <td className="text-right">
                    <Button type="button" variant="secondary" onClick={() => setExpandedEodDateKey(row.dateKey)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>EOW Summary</strong>
                </td>
                <td className="text-right tabular-nums">
                  <strong>{eodWeeklySummary.deals}</strong>
                </td>
                <td className="text-right tabular-nums">
                  <strong>${formatNum(eodWeeklySummary.marketing, 0)}</strong>
                </td>
                <td className="text-right tabular-nums">
                  <strong>{eodWeeklySummary.cpa === null ? 'N/A' : `$${formatNum(eodWeeklySummary.cpa)}`}</strong>
                </td>
                <td />
              </tr>
            </tbody>
          </DataTable>
        </TableWrap>
        <p className="text-xs text-slate-500">
          {eodWeeklySummary.finalized
            ? `Summary last refreshed: ${formatTimestamp(eodWeeklySummary.updatedAt)}`
            : 'Weekly summary finalizes Friday at 6:15 PM and refreshes if new data is added after cutoff.'}
        </p>
      </Card>

      <Card className="space-y-4">
        <CardTitle>{monthLabel}</CardTitle>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Snapshot</th>
                <th className="text-right">Total Deals</th>
                <th className="text-right">Total Marketing</th>
                <th className="text-right">CPA</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{eodWeekOptions.find((option) => option.weekKey === selectedEodWeekKey)?.label ?? formatDateKey(selectedEodWeekKey)}</td>
                <td className="text-right tabular-nums">{eodWeeklySummary.deals}</td>
                <td className="text-right tabular-nums">${formatNum(eodWeeklySummary.marketing, 0)}</td>
                <td className="text-right tabular-nums">{eodWeeklySummary.cpa === null ? 'N/A' : `$${formatNum(eodWeeklySummary.cpa)}`}</td>
                <td>{formatTimestamp(eodWeeklySummary.updatedAt)}</td>
              </tr>
            </tbody>
          </DataTable>
        </TableWrap>
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
        if (!day) return null
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
                EOD Report - {formatDateKey(day.dateKey)}
              </CardTitle>
              <div className="mobile-modal-scroll flex-1 space-y-4 p-4">
                <div className="grid max-w-md gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">House Sales</p>
                    <p className="text-lg font-semibold text-slate-900">{day.houseSales}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">House CPA</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {day.houseCpa === null ? 'N/A' : `$${formatNum(day.houseCpa)}`}
                    </p>
                  </div>
                </div>
                {day.reportText ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Report</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{day.reportText}</p>
                  </div>
                ) : null}
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
