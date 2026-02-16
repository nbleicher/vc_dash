import { useEffect, useState } from 'react'
import { Badge, Button, Card, CardTitle, Input, MetricCard, Select } from '../components'
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
  intraSubmissions: DataStore['intraSubmissions']
  onResolveQa: (id: string) => void
  onToggleAuditFlag: (id: string, field: 'mgmtNotified' | 'outreachMade') => void
  onGoToAttendance: () => void
  onUpsertSnapshot: (
    slot: (typeof SLOT_CONFIG)[number],
    agentId: string,
    calls: number,
    sales: number
  ) => void
  onSubmitIntraSlot: (slot: string) => void
  isIntraSlotEditable: (slot: string) => boolean
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
  intraSubmissions,
  onResolveQa,
  onToggleAuditFlag,
  onGoToAttendance,
  onUpsertSnapshot,
  onSubmitIntraSlot,
  isIntraSlotEditable,
}: Props) {
  const [entryForm, setEntryForm] = useState<{ agentId: string; slot: string; calls: number; sales: number }>({
    agentId: '',
    slot: SLOT_CONFIG[0].key,
    calls: 0,
    sales: 0,
  })

  useEffect(() => {
    setEntryForm((prev) => {
      const defaultAgentId = activeAgents[0]?.id ?? ''
      const safeAgentId = activeAgents.some((agent) => agent.id === prev.agentId) ? prev.agentId : defaultAgentId
      const safeSlot = SLOT_CONFIG.some((slot) => slot.key === prev.slot) ? prev.slot : SLOT_CONFIG[0].key
      const snap =
        snapshots.find((item) => item.dateKey === todayKey && item.slot === safeSlot && item.agentId === safeAgentId) ?? null
      return {
        agentId: safeAgentId,
        slot: safeSlot,
        calls: snap?.billableCalls ?? prev.calls ?? 0,
        sales: snap?.sales ?? prev.sales ?? 0,
      }
    })
  }, [activeAgents, snapshots, todayKey])

  const selectedSlot = SLOT_CONFIG.find((slot) => slot.key === entryForm.slot) ?? SLOT_CONFIG[0]
  const selectedSubmission =
    intraSubmissions.find((item) => item.dateKey === todayKey && item.slot === selectedSlot.key) ?? null
  const selectedSlotEditable = isIntraSlotEditable(selectedSlot.key)
  const entryCpa = entryForm.sales > 0 ? (entryForm.calls * 15) / entryForm.sales : null

  const loadDraftForSelection = (agentId: string, slot: string): void => {
    const snap = snapshots.find((item) => item.dateKey === todayKey && item.slot === slot && item.agentId === agentId) ?? null
    setEntryForm((prev) => ({
      ...prev,
      agentId,
      slot,
      calls: snap?.billableCalls ?? 0,
      sales: snap?.sales ?? 0,
    }))
  }

  const handleSaveDraft = (): void => {
    if (!entryForm.agentId) return
    onUpsertSnapshot(selectedSlot, entryForm.agentId, Math.max(0, entryForm.calls), Math.max(0, entryForm.sales))
  }

  const handleSubmitSlot = (): void => {
    if (!entryForm.agentId) return
    onUpsertSnapshot(selectedSlot, entryForm.agentId, Math.max(0, entryForm.calls), Math.max(0, entryForm.sales))
    onSubmitIntraSlot(selectedSlot.key)
  }

  return (
    <div className="page-grid">
      {attendanceAlert && (
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <div className="flex items-center justify-between gap-3">
            <strong>Attendance Alert</strong>
            <Badge variant="warning">Needs Review</Badge>
          </div>
          <p>Attendance is incomplete for today after 5:30 PM EST.</p>
          <Button variant="default" className="mt-2" onClick={onGoToAttendance}>
            Complete Attendance
          </Button>
        </Card>
      )}
      {intraAlert && (
        <Card className="border-red-200 bg-red-50 text-red-900">
          <div className="flex items-center justify-between gap-3">
            <strong>Intra-Performance Alert</strong>
            <Badge variant="danger">Critical</Badge>
          </div>
          <p>Intra-day performance is incomplete for: {overdueSlots.map((s) => s.label).join(', ')}.</p>
        </Card>
      )}

      <Card className="space-y-4">
        <CardTitle>House Pulse</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard title="Total Sales" value={houseLive.totalSales} />
          <MetricCard title="Total Billable Calls" value={houseLive.totalCalls} />
          <MetricCard title="Total Marketing" value={`$${formatNum(houseLive.marketing, 0)}`} />
          <MetricCard title="Floor CPA" value={houseLive.cpa === null ? 'N/A' : `$${formatNum(houseLive.cpa)}`} />
          <MetricCard title="Floor CVR" value={houseLive.cvr === null ? 'N/A' : `${formatNum(houseLive.cvr * 100)}%`} />
          <MetricCard title="Floor Capacity (Mon-Fri)" value={formatNum(floorCapacity, 2)} />
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Weekly Target Trend</CardTitle>
        {weekTarget ? (
          <div className="split">
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p>Sales Goal</p>
              <strong className="text-lg text-slate-900">
                {weekTrend.totalSales} / {weekTarget.targetSales}
              </strong>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-primary" style={{ width: `${weekTrend.salesProgress ?? 0}%` }} />
              </div>
              <p className="text-sm text-slate-500">
                {weekTrend.salesProgress !== null && weekTrend.salesProgress >= 100
                  ? 'Goal met or exceeded'
                  : 'Tracking toward weekly goal'}
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p>CPA Goal</p>
              <strong className="text-lg text-slate-900">
                Current: {weekTrend.currentCpa === null ? 'N/A' : `$${formatNum(weekTrend.currentCpa)}`} | Target: $
                {formatNum(weekTarget.targetCpa)}
              </strong>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full ${weekTrend.cpaDelta !== null && weekTrend.cpaDelta > 0 ? 'bg-red-500' : 'bg-primary'}`}
                  style={{
                    width:
                      weekTrend.currentCpa !== null && weekTrend.cpaTarget !== null && weekTrend.cpaTarget > 0
                        ? `${Math.min((weekTrend.currentCpa / weekTrend.cpaTarget) * 100, 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {weekTrend.cpaDelta === null
                  ? 'Need sales data for CPA trend'
                  : weekTrend.cpaDelta <= 0
                    ? 'On or below target CPA'
                    : `Above target by $${formatNum(weekTrend.cpaDelta)}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No weekly target set yet. Set it in Tasks {'->'} Weekly Targets.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <CardTitle>Action Center</CardTitle>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3>Check Recordings</h3>
              <Badge variant="warning">Needs Review</Badge>
            </div>
            {actionQa.length === 0 && <p className="text-sm text-slate-500">N/A - no flagged QA items.</p>}
            {actionQa.map((q) => (
              <div key={q.id} className="alert-card">
                <p>
                  <strong>{agents.find((a) => a.id === q.agentId)?.name ?? 'Unknown Agent'}</strong> - {q.clientName}
                </p>
                <p className="text-sm text-slate-500">Notes: {q.notes || 'N/A'}</p>
                <Button onClick={() => onResolveQa(q.id)} className="mt-2" variant="default">
                  Mark Resolved & Archive
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3>Action Needed (Audit)</h3>
              <Badge variant="danger">Critical</Badge>
            </div>
            {actionAudit.length === 0 && <p className="text-sm text-slate-500">N/A - no active Action Needed items.</p>}
            {actionAudit.map((a) => {
              const ageHrs = (now.getTime() - new Date(a.discoveryTs).getTime()) / 3_600_000
              return (
                <div key={a.id} className={`alert-card ${ageHrs > 4 ? 'stale-alert' : ''}`}>
                  <p>
                    <strong>{agents.find((x) => x.id === a.agentId)?.name ?? 'Unknown Agent'}</strong> - {a.clientName}
                  </p>
                  <p className="status-text">
                    {a.carrier} | {a.currentStatus} | discovered {formatTimestamp(a.discoveryTs)}
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={a.mgmtNotified}
                      onChange={() => onToggleAuditFlag(a.id, 'mgmtNotified')}
                    />
                    Management Notified Agent
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={a.outreachMade}
                      onChange={() => onToggleAuditFlag(a.id, 'outreachMade')}
                    />
                    Agent Attempted Outreach
                  </label>
                  <p className="text-sm text-slate-500">Timestamp 2: {formatTimestamp(a.resolutionTs)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Intra-Day Performance Entry</CardTitle>
        {activeAgents.length === 0 ? (
          <p className="text-sm text-slate-500">N/A - no active agents.</p>
        ) : (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Agent
                <Select
                  className="mt-1"
                  value={entryForm.agentId}
                  onChange={(e) => loadDraftForSelection(e.target.value, entryForm.slot)}
                >
                  <option value="">Select agent</option>
                  {activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Time
                <Select
                  className="mt-1"
                  value={entryForm.slot}
                  onChange={(e) => loadDraftForSelection(entryForm.agentId, e.target.value)}
                >
                  {SLOT_CONFIG.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedSubmission ? 'success' : 'warning'}>
                {selectedSubmission ? 'Submitted' : 'Pending'}
              </Badge>
              <Badge variant={selectedSlotEditable ? 'neutral' : 'danger'}>
                {selectedSlotEditable ? 'Editable Window Open' : 'Locked (Window Closed)'}
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Calls
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={entryForm.calls}
                  disabled={!selectedSlotEditable}
                  onChange={(e) => setEntryForm((prev) => ({ ...prev, calls: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Sales
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={entryForm.sales}
                  disabled={!selectedSlotEditable}
                  onChange={(e) => setEntryForm((prev) => ({ ...prev, sales: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>

            <p className="text-xs text-slate-500">CPA: {entryCpa === null ? 'N/A' : `$${formatNum(entryCpa)}`}</p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={!selectedSlotEditable} onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button type="button" variant="default" disabled={!selectedSlotEditable} onClick={handleSubmitSlot}>
                Submit Hour
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
