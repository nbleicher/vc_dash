import { useMemo, useState } from 'react'
import { Button, Card, CardTitle, DataTable, Field, FieldLabel, Input, Select, TableWrap, Textarea } from '../components'
import type { ShadowLog } from '../types'
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
  onStartShadow: (managerName: string) => void
  onAddCall: () => void
  onEndShadow: () => void
  onShadowInteraction: () => void
  onDeleteShadowCall: (logId: string, callId: string) => void
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
  onStartShadow,
  onAddCall,
  onEndShadow,
  onShadowInteraction,
  onDeleteShadowCall,
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
        <div className="control-bar grid gap-3 md:grid-cols-2">
          <Field className="w-full min-w-0">
              <FieldLabel>Agent</FieldLabel>
              <Select value={agentPageAgentId} onChange={(e) => setAgentPageAgentId(e.target.value)}>
                {activeAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
          </Field>
          <Field className="w-full min-w-0">
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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {agentWeekRows.map((row) => (
            <div
              key={row.dateKey}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            >
              <div className="mb-2 flex items-start justify-between border-b border-slate-200 pb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{row.dayLabel.slice(0, 3)}</p>
                  <p className="text-[11px] text-slate-500">{row.dateKey}</p>
                </div>
                <p className="text-base font-semibold leading-none text-slate-900">{row.sales}</p>
              </div>
              <div className="space-y-1 text-[11px] text-slate-700">
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Calls</span>
                  <span className="tabular-nums">{row.calls}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Mkt</span>
                  <span className="tabular-nums">${formatNum(row.marketing, 0)}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">CPA</span>
                  <span className="tabular-nums">{row.cpa === null ? 'N/A' : `$${formatNum(row.cpa)}`}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
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
        </div>
        <p className="text-sm text-slate-600">Current agent: {selectedAgentName}</p>

        {groupedDates.map((dateKey) => {
          const logs = shadowLogsByDateForAgent.get(dateKey) ?? []
          return (
            <div key={dateKey} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{dateKey}</h3>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="space-y-2 rounded-lg border border-slate-200 p-3"
                  onBlurCapture={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onShadowInteraction()
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Manager: {log.managerName} | Start: {formatTimestamp(log.startedAt)} | End:{' '}
                      {log.endedAt ? formatTimestamp(log.endedAt) : 'Active'}
                    </p>
                    <p className="text-xs text-slate-500">Last Saved: {formatTimestamp(log.updatedAt)}</p>
                  </div>
                  <TableWrap>
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Notes</th>
                          <th>Coaching</th>
                          <th>Duration</th>
                          <th>Sale</th>
                          <th>Actions</th>
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
                            <td className="text-right">
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => onDeleteShadowCall(log.id, call.id)}
                                disabled={log.endedAt !== null}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {log.calls.length === 0 && (
                          <tr>
                            <td colSpan={5}>N/A</td>
                          </tr>
                        )}
                      </tbody>
                    </DataTable>
                  </TableWrap>
                  {log.endedAt === null && (
                    <div className="row-wrap pt-2">
                      <Button type="button" variant="secondary" onClick={onAddCall}>
                        Add Call
                      </Button>
                      {activeLog ? (
                        <Button type="button" variant="danger" onClick={onEndShadow}>
                          End Shadow
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </Card>

    </div>
  )
}
