import { useState } from 'react'
import { Button, Card, CardTitle, Field, FieldLabel, Input, Textarea } from './ui'
import { MetricCard } from './MetricCard'
import type { PerfHistory } from '../types'
import { formatDateKey, formatNum, uid } from '../utils'

const CPA_HIGHLIGHT_THRESHOLD = 130

export type EodHistoryDay = {
  dateKey: string
  houseSales: number
  houseCpa: number | null
  reportText?: string
  submittedAt?: string
  agentRows: Array<{
    agentId: string
    agentName: string
    calls: number
    sales: number
    marketing: number
    cpa: number | null
    cvr: number | null
  }>
}

type Props = {
  currentWeekKey: string
  todayKey: string
  eodTodayTotals: { sales: number; marketing: number; cpa: number | null }
  eodHistoryDays: EodHistoryDay[]
  onSaveEodReport: (weekKey: string, reportText: string, houseSales: number, houseCpa: number | null) => void
  activeAgents: Array<{ id: string; name: string }>
  setPerfHistory: React.Dispatch<React.SetStateAction<PerfHistory[]>>
}

export function EodReportSection({
  currentWeekKey,
  todayKey: _todayKey, // eslint-disable-line @typescript-eslint/no-unused-vars -- required by Props, reserved for future use
  eodTodayTotals,
  eodHistoryDays,
  onSaveEodReport,
  activeAgents,
  setPerfHistory,
}: Props) {
  const [eodReportText, setEodReportText] = useState('')
  const [expandedEodDateKey, setExpandedEodDateKey] = useState<string | null>(null)
  const [showAddPastDayForm, setShowAddPastDayForm] = useState(false)
  const [addPastDayDateKey, setAddPastDayDateKey] = useState('')
  const [addPastDayRows, setAddPastDayRows] = useState<Record<string, { calls: string; sales: string; marketing: string }>>({})
  const [editingEodDateKey, setEditingEodDateKey] = useState<string | null>(null)
  const [editEodRows, setEditEodRows] = useState<Record<string, { calls: string; sales: string; marketing: string }>>({})

  return (
    <Card className="space-y-4">
      <CardTitle>EOD Report</CardTitle>
      <div className="flex flex-col gap-5">
          <p className="text-sm text-slate-500">House metrics for today (EOD). Write your report and submit to save to vault history.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard title="House Sales" value={eodTodayTotals.sales} />
            <MetricCard
              title="House CPA"
              value={
                eodTodayTotals.cpa === null ? 'N/A' : `$${formatNum(eodTodayTotals.cpa)}`
              }
            />
          </div>
          <Field>
            <FieldLabel>Report</FieldLabel>
            <Textarea
              value={eodReportText}
              onChange={(e) => setEodReportText(e.target.value)}
              placeholder="Enter your EOD report..."
              rows={6}
              className="w-full"
            />
          </Field>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              onSaveEodReport(currentWeekKey, eodReportText, eodTodayTotals.sales, eodTodayTotals.cpa)
              setEodReportText('')
            }}
          >
            Submit & Save to Vault
          </Button>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-slate-700">EOD Report History (Vault)</h3>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAddPastDayForm((v) => !v)
                  if (!showAddPastDayForm) {
                    setAddPastDayDateKey('')
                    setAddPastDayRows(
                      Object.fromEntries(activeAgents.map((a) => [a.id, { calls: '', sales: '', marketing: '' }])),
                    )
                  }
                }}
              >
                {showAddPastDayForm ? 'Cancel' : 'Add performance for past day'}
              </Button>
            </div>
            {showAddPastDayForm && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <Field>
                  <FieldLabel>Date</FieldLabel>
                  <Input
                    type="date"
                    value={addPastDayDateKey}
                    onChange={(e) => setAddPastDayDateKey(e.target.value)}
                    className="w-full max-w-xs"
                  />
                </Field>
                <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="p-2 font-medium text-slate-700">Agent</th>
                        <th className="p-2 font-medium text-slate-700">Calls</th>
                        <th className="p-2 font-medium text-slate-700">Sales</th>
                        <th className="p-2 font-medium text-slate-700">Marketing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAgents.map((agent) => {
                        const row = addPastDayRows[agent.id] ?? { calls: '', sales: '', marketing: '' }
                        return (
                          <tr key={agent.id} className="border-b border-slate-100">
                            <td className="p-2 font-medium">{agent.name}</td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.calls}
                                onChange={(e) =>
                                  setAddPastDayRows((prev) => ({
                                    ...prev,
                                    [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), calls: e.target.value },
                                  }))
                                }
                                placeholder="0"
                                className="w-20"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.sales}
                                onChange={(e) =>
                                  setAddPastDayRows((prev) => ({
                                    ...prev,
                                    [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), sales: e.target.value },
                                  }))
                                }
                                placeholder="0"
                                className="w-20"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={row.marketing}
                                onChange={(e) =>
                                  setAddPastDayRows((prev) => ({
                                    ...prev,
                                    [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), marketing: e.target.value },
                                  }))
                                }
                                placeholder="0"
                                className="w-24"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      if (!addPastDayDateKey.trim()) return
                      const newRows: PerfHistory[] = []
                      for (const agent of activeAgents) {
                        const row = addPastDayRows[agent.id]
                        if (!row) continue
                        const calls = Math.max(0, Math.floor(Number(row.calls) || 0))
                        const sales = Math.max(0, Number(row.sales) || 0)
                        const marketing = Math.max(0, Number(row.marketing) || 0)
                        if (calls === 0 && sales === 0 && marketing === 0) continue
                        const cpa = sales > 0 ? marketing / sales : null
                        const cvr = calls > 0 ? sales / calls : null
                        newRows.push({
                          id: uid('perf'),
                          dateKey: addPastDayDateKey,
                          agentId: agent.id,
                          billableCalls: calls,
                          sales,
                          marketing,
                          cpa,
                          cvr,
                          frozenAt: new Date().toISOString(),
                        })
                      }
                      if (newRows.length === 0) return
                      setPerfHistory((prev) => [...prev, ...newRows])
                      setShowAddPastDayForm(false)
                      setAddPastDayDateKey('')
                      setAddPastDayRows({})
                    }}
                  >
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowAddPastDayForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {eodHistoryDays.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr className="border-b border-slate-200">
                        <th className="p-2 font-medium text-slate-700">Date</th>
                        <th className="p-2 font-medium text-slate-700 text-right">Sales</th>
                        <th className="p-2 font-medium text-slate-700 text-right">CPA</th>
                        <th className="p-2 font-medium text-slate-700">Preview</th>
                        <th className="p-2 text-right" aria-label="Actions">
                          Open / Edit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {eodHistoryDays.map((day) => (
                        <tr
                          key={day.dateKey}
                          className="border-b border-slate-200 cursor-pointer hover:bg-slate-100/80"
                          onClick={() => setExpandedEodDateKey(day.dateKey)}
                        >
                          <td className="p-2 font-medium">{formatDateKey(day.dateKey)}</td>
                          <td className="p-2 text-right tabular-nums">{day.houseSales}</td>
                          <td className="p-2 text-right tabular-nums">
                            {day.houseCpa === null ? 'N/A' : `$${formatNum(day.houseCpa)}`}
                          </td>
                          <td className="p-2 text-slate-600 truncate max-w-[200px]">
                            {day.reportText ? `${day.reportText.slice(0, 50)}${day.reportText.length > 50 ? '…' : ''}` : '—'}
                          </td>
                          <td className="p-2 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setExpandedEodDateKey(day.dateKey)}
                            >
                              Open
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setEditingEodDateKey(day.dateKey)
                                const initial: Record<string, { calls: string; sales: string; marketing: string }> = {}
                                for (const a of activeAgents) {
                                  const row = day.agentRows.find((r) => r.agentId === a.id)
                                  initial[a.id] = row
                                    ? { calls: String(row.calls), sales: String(row.sales), marketing: String(row.marketing) }
                                    : { calls: '', sales: '', marketing: '' }
                                }
                                setEditEodRows(initial)
                              }}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No EOD history yet. Submit a report or add performance for a past day.</p>
            )}
            {expandedEodDateKey && (() => {
              const day = eodHistoryDays.find((d) => d.dateKey === expandedEodDateKey)
              if (!day) return null
              return (
                <div
                  className="mobile-modal-scroll fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="eod-detail-title"
                  onClick={() => setExpandedEodDateKey(null)}
                >
                  <Card
                    className="my-4 flex max-h-[90dvh] w-full min-w-0 max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-4xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CardTitle id="eod-detail-title" className="border-b border-slate-200 pb-3">
                      EOD Report — {formatDateKey(day.dateKey)}
                    </CardTitle>
                    <div className="mobile-modal-scroll flex-1 p-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2 max-w-md">
                        <MetricCard title="House Sales" value={day.houseSales} />
                        <MetricCard
                          title="House CPA"
                          value={day.houseCpa === null ? 'N/A' : `$${formatNum(day.houseCpa)}`}
                        />
                      </div>
                      {day.reportText ? (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Report</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{day.reportText}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Agent performance</p>
                        {day.agentRows.length === 0 ? (
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
                                {day.agentRows.map((row) => {
                                  const cpaOverThreshold = row.cpa !== null && row.cpa > CPA_HIGHLIGHT_THRESHOLD
                                  return (
                                    <tr
                                      key={row.agentId}
                                      className={`border-b border-slate-100 ${cpaOverThreshold ? 'bg-red-500/10' : ''}`}
                                    >
                                      <td className="p-2 font-medium">{row.agentName}</td>
                                      <td className="p-2 text-right tabular-nums">
                                        {row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}
                                      </td>
                                      <td className="p-2 text-right tabular-nums">{row.sales}</td>
                                      <td className="p-2 text-right tabular-nums">{row.calls}</td>
                                      <td className="p-2 text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                                      <td className="p-2 text-right tabular-nums">
                                        {row.cvr === null ? 'N/A' : `${formatNum(row.cvr * 100)}%`}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-200 p-4 bg-slate-50">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => setExpandedEodDateKey(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </Card>
                </div>
              )
            })()}
            {editingEodDateKey && (() => {
              const day = eodHistoryDays.find((d) => d.dateKey === editingEodDateKey)
              if (!day) return null
              return (
                <div
                  className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="eod-edit-title"
                  onClick={() => setEditingEodDateKey(null)}
                >
                  <Card className="my-4 w-full min-w-0 max-w-[calc(100vw-2rem)] sm:max-w-2xl" onClick={(e) => e.stopPropagation()}>
                    <CardTitle id="eod-edit-title" className="border-b border-slate-200 pb-3">
                      Edit performance — {formatDateKey(editingEodDateKey)}
                    </CardTitle>
                    <div className="p-4 space-y-4">
                      <p className="text-sm text-slate-500">
                        Update calls, sales, and marketing per agent. Save replaces all performance data for this day.
                      </p>
                      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="p-2 font-medium text-slate-700">Agent</th>
                              <th className="p-2 font-medium text-slate-700">Calls</th>
                              <th className="p-2 font-medium text-slate-700">Sales</th>
                              <th className="p-2 font-medium text-slate-700">Marketing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeAgents.map((agent) => {
                              const row = editEodRows[agent.id] ?? { calls: '', sales: '', marketing: '' }
                              return (
                                <tr key={agent.id} className="border-b border-slate-100">
                                  <td className="p-2 font-medium">{agent.name}</td>
                                  <td className="p-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={row.calls}
                                      onChange={(e) =>
                                        setEditEodRows((prev) => ({
                                          ...prev,
                                          [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), calls: e.target.value },
                                        }))
                                      }
                                      placeholder="0"
                                      className="w-20"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={row.sales}
                                      onChange={(e) =>
                                        setEditEodRows((prev) => ({
                                          ...prev,
                                          [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), sales: e.target.value },
                                        }))
                                      }
                                      placeholder="0"
                                      className="w-20"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={row.marketing}
                                      onChange={(e) =>
                                        setEditEodRows((prev) => ({
                                          ...prev,
                                          [agent.id]: { ...(prev[agent.id] ?? { calls: '', sales: '', marketing: '' }), marketing: e.target.value },
                                        }))
                                      }
                                      placeholder="0"
                                      className="w-24"
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => {
                            if (!editingEodDateKey) return
                            const newRows: PerfHistory[] = []
                            for (const agent of activeAgents) {
                              const row = editEodRows[agent.id]
                              if (!row) continue
                              const calls = Math.max(0, Math.floor(Number(row.calls) || 0))
                              const sales = Math.max(0, Number(row.sales) || 0)
                              const marketing = Math.max(0, Number(row.marketing) || 0)
                              if (calls === 0 && sales === 0 && marketing === 0) continue
                              const cpa = sales > 0 ? marketing / sales : null
                              const cvr = calls > 0 ? sales / calls : null
                              newRows.push({
                                id: uid('perf'),
                                dateKey: editingEodDateKey,
                                agentId: agent.id,
                                billableCalls: calls,
                                sales,
                                marketing,
                                cpa,
                                cvr,
                                frozenAt: new Date().toISOString(),
                              })
                            }
                            setPerfHistory((prev) => [...prev.filter((p) => p.dateKey !== editingEodDateKey), ...newRows])
                            setEditingEodDateKey(null)
                            setEditEodRows({})
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditingEodDateKey(null)
                            setEditEodRows({})
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })()}
          </div>
      </div>
    </Card>
  )
}
