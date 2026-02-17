import { Card, CardTitle, DataTable, Field, FieldLabel, Select, TableWrap } from '../components'
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
}

export function EodPage({
  selectedEodWeekKey,
  setSelectedEodWeekKey,
  eodWeekOptions,
  eodWeeklyRows,
  eodWeeklySummary,
  monthLabel,
}: Props) {
  return (
    <div className="page-grid">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <CardTitle>Week of {formatWeekRangeLabel(selectedEodWeekKey)}</CardTitle>
          <Field className="min-w-[220px]">
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
                <th className="text-right">Total Deals (House)</th>
                <th className="text-right">Total Marketing (House)</th>
                <th className="text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {eodWeeklyRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dayLabel}</td>
                  <td className="text-right tabular-nums">{row.deals}</td>
                  <td className="text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                  <td className="text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>EOW Summary (Updated Fri @ 6:15 PM)</strong>
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
    </div>
  )
}
