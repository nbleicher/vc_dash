import { useMemo, useState } from 'react'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Textarea } from '../components'
import type { RankMetric, ShadowLog } from '../types'
import { formatNum, formatTimestamp } from '../utils'

type AgentWeekRow = {
  dayLabel: string
  dateKey: string
  sales: number
  calls: number
  marketing: number
  cpa: number | null
}

type Props = {
  activeAgents: Array<{ id: string; name: string }>
  agentPageAgentId: string
  setAgentPageAgentId: (id: string) => void
  selectedAgentWeekKey: string
  setSelectedAgentWeekKey: (key: string) => void
  eodWeekOptions: Array<{ weekKey: string; label: string }>
  agentWeekRows: AgentWeekRow[]
  shadowLogsByDateForAgent: Map<string, ShadowLog[]>
  rankRows: Array<{ agentId: string; agentName: string; sales: number; cpa: number | null; cvr: number | null }>
  rankMetric: RankMetric
  setRankMetric: (m: RankMetric) => void
  onStartShadow: (managerName: string) => void
  onAddCall: () => void
  onEndShadow: () => void
  onUpdateShadowCall: (
    logId: string,
    callId: string,
    patch: Partial<{ notes: string; coaching: string; durationMinutes: number | null; sale: boolean }>,
  ) => void
  todayKey: string
}

export function AgentPage({
  activeAgents,
  agentPageAgentId,
  setAgentPageAgentId,
  selectedAgentWeekKey,
  setSelectedAgentWeekKey,
  eodWeekOptions,
  agentWeekRows,
  shadowLogsByDateForAgent,
  rankRows,
  rankMetric,
  setRankMetric,
  onStartShadow,
  onAddCall,
  onEndShadow,
  onUpdateShadowCall,
  todayKey,
}: Props) {
  const [managerName, setManagerName] = useState('')
  const selectedAgentName = activeAgents.find((a) => a.id === agentPageAgentId)?.name ?? 'N/A'
  const currentDateKey = todayKey
  const shadowLogs = shadowLogsByDateForAgent.get(currentDateKey ?? '') ?? []
  const activeLog = shadowLogs.find((log) => log.endedAt === null) ?? null
  const groupedDates = useMemo(
    () => [...shadowLogsByDateForAgent.keys()].sort((a, b) => b.localeCompare(a)),
    [shadowLogsByDateForAgent],
  )

  return (
    <div className="page-grid">
      <Card className="space-y-4">
        <CardTitle>Agent Focus</CardTitle>
        <div className="row-wrap control-bar">
          <Field className="w-full min-w-0 sm:min-w-[260px]">
            <FieldLabel>Agent</FieldLabel>
            <Select value={agentPageAgentId} onChange={(e) => setAgentPageAgentId(e.target.value)}>
              {activeAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="w-full min-w-0 sm:min-w-[220px]">
            <FieldLabel>Week</FieldLabel>
            <Select value={selectedAgentWeekKey} onChange={(e) => setSelectedAgentWeekKey(e.target.value)}>
              {eodWeekOptions.map((option) => (
                <option key={option.weekKey} value={option.weekKey}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Weekly KPI Calendar (M-F)</CardTitle>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Calls</th>
                <th className="text-right">Marketing</th>
                <th className="text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {agentWeekRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dayLabel}</td>
                  <td>{row.dateKey}</td>
                  <td className="text-right tabular-nums">{row.sales}</td>
                  <td className="text-right tabular-nums">{row.calls}</td>
                  <td className="text-right tabular-nums">${formatNum(row.marketing, 0)}</td>
                  <td className="text-right tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Shadow Log</CardTitle>
        <div className="row-wrap control-bar">
          <Field className="w-full min-w-0 sm:min-w-[260px]">
            <FieldLabel>Manager Name</FieldLabel>
            <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Enter manager name" />
          </Field>
          <Button type="button" onClick={() => onStartShadow(managerName)} disabled={!managerName.trim() || !!activeLog}>
            Start Shadow
          </Button>
          <Button type="button" variant="secondary" onClick={onAddCall} disabled={!activeLog}>
            Add Call
          </Button>
          <Button type="button" variant="danger" onClick={onEndShadow} disabled={!activeLog}>
            End Shadow
          </Button>
        </div>
        <p className="text-sm text-slate-600">Current agent: {selectedAgentName}</p>

        {groupedDates.map((dateKey) => {
          const logs = shadowLogsByDateForAgent.get(dateKey) ?? []
          return (
            <div key={dateKey} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{dateKey}</h3>
              {logs.map((log) => (
                <div key={log.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">
                    Manager: {log.managerName} | Start: {formatTimestamp(log.startedAt)} | End:{' '}
                    {log.endedAt ? formatTimestamp(log.endedAt) : 'Active'}
                  </p>
                  <TableWrap>
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Notes</th>
                          <th>Coaching</th>
                          <th>Duration</th>
                          <th>Sale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.calls.map((call) => (
                          <tr key={call.id}>
                            <td>
                              <Textarea
                                className="min-h-[72px]"
                                value={call.notes}
                                disabled={log.endedAt !== null}
                                onChange={(e) => onUpdateShadowCall(log.id, call.id, { notes: e.target.value })}
                              />
                            </td>
                            <td>
                              <Textarea
                                className="min-h-[72px]"
                                value={call.coaching}
                                disabled={log.endedAt !== null}
                                onChange={(e) => onUpdateShadowCall(log.id, call.id, { coaching: e.target.value })}
                              />
                            </td>
                            <td>
                              <Input
                                type="number"
                                min={0}
                                value={call.durationMinutes ?? ''}
                                disabled={log.endedAt !== null}
                                onChange={(e) =>
                                  onUpdateShadowCall(log.id, call.id, {
                                    durationMinutes: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                              />
                            </td>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                checked={call.sale}
                                disabled={log.endedAt !== null}
                                onChange={(e) => onUpdateShadowCall(log.id, call.id, { sale: e.target.checked })}
                              />
                            </td>
                          </tr>
                        ))}
                        {log.calls.length === 0 && (
                          <tr>
                            <td colSpan={4}>N/A</td>
                          </tr>
                        )}
                      </tbody>
                    </DataTable>
                  </TableWrap>
                </div>
              ))}
            </div>
          )
        })}
      </Card>

      <Card className="space-y-4">
        <CardTitle>Agent Ranking (Standard)</CardTitle>
        <Field className="w-full min-w-0 sm:min-w-[180px]">
          <FieldLabel>Metric</FieldLabel>
          <Select value={rankMetric} onChange={(e) => setRankMetric(e.target.value as RankMetric)}>
            <option>Sales</option>
            <option>CPA</option>
            <option>CVR</option>
          </Select>
        </Field>
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
              {rankRows.map((row, idx) => (
                <tr key={row.agentId} className={row.agentId === agentPageAgentId ? '!bg-blue-50' : undefined}>
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
    </div>
  )
}
