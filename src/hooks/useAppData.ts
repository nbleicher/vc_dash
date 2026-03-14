import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DataStore } from '../data'
import { SLOT_CONFIG } from '../constants'
import type {
  HistorySort,
  MetricsScope,
  PerfHistory,
  RankMetric,
  RankPeriod,
  Snapshot,
  TaskPage,
  TransferRecord,
  VaultHistoryView,
  VaultScope,
} from '../types'
import {
  computeMetrics,
  estDateKey,
  estParts,
  formatDateKey,
  formatTimestamp,
  formatWeekRangeLabel,
  monFriDatesForWeek,
  normalizeIsoTimestamp,
  uid,
  weekKeyFromDateKey,
  weekKeyMonFri,
  dateKeysBetween,
} from '../utils'

/** First week for EOD/EOW weekly views: week containing January 5 (1/5). */
const EOD_VIEWS_START_DATE_KEY = '2025-01-05'

type SlotConfig = (typeof SLOT_CONFIG)[number]

export function useAppData(store: DataStore) {
  const {
    agents,
    snapshots,
    perfHistory,
    eodReports,
    qaRecords,
    auditRecords,
    attendance,
    spiffRecords,
    attendanceSubmissions,
    intraSubmissions,
    weeklyTargets,
    transfers,
    setPerfHistory,
    setSnapshots,
    houseMarketing,
  } = store

  const [now, setNow] = useState<Date>(new Date())
  const [taskPage, setTaskPage] = useState<TaskPage>('spiff')
  const [metricsScope, setMetricsScope] = useState<MetricsScope>('house')
  const [metricsAgentId, setMetricsAgentId] = useState('')
  const [vaultAgentId, setVaultAgentId] = useState('')
  const [vaultHistoryView, setVaultHistoryView] = useState<VaultHistoryView>('qa')
  const [vaultScope, setVaultScope] = useState<VaultScope>('house')
  const [historySort, setHistorySort] = useState<HistorySort>('newest')
  const [rankMetric, setRankMetric] = useState<RankMetric>('Sales')
  const [rankPeriod, setRankPeriod] = useState<RankPeriod>('day')
  const [kpiPeriod, setKpiPeriod] = useState<RankPeriod>('day')
  const [metricsDateStart, setMetricsDateStart] = useState<string | null>(null)
  const [metricsDateEnd, setMetricsDateEnd] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const activeAgents = useMemo(() => agents.filter((a) => a.active), [agents])
  const todayKey = useMemo(() => estDateKey(now), [now])
  const currentWeekKey = useMemo(() => weekKeyMonFri(now), [now])
  const weekDates = useMemo(() => monFriDatesForWeek(currentWeekKey), [currentWeekKey])
  const [selectedAttendanceWeekKey, setSelectedAttendanceWeekKey] = useState<string>(currentWeekKey)
  const est = estParts(now)

  const attendanceWeekOptions = useMemo(() => {
    const weekKeys = new Set(attendance.map((row) => row.weekKey))
    for (const row of spiffRecords) weekKeys.add(row.weekKey)
    weekKeys.add(currentWeekKey)
    return [...weekKeys]
      .sort((a, b) => b.localeCompare(a))
      .map((weekKey) => {
        const dates = monFriDatesForWeek(weekKey)
        return { weekKey, label: `${formatDateKey(dates[0])}-${formatDateKey(dates[dates.length - 1])}` }
      })
  }, [attendance, spiffRecords, currentWeekKey])
  const effectiveAttendanceWeekKey = useMemo(
    () =>
      attendanceWeekOptions.some((option) => option.weekKey === selectedAttendanceWeekKey)
        ? selectedAttendanceWeekKey
        : currentWeekKey,
    [attendanceWeekOptions, currentWeekKey, selectedAttendanceWeekKey],
  )
  const attendanceWeekDates = useMemo(
    () => monFriDatesForWeek(effectiveAttendanceWeekKey),
    [effectiveAttendanceWeekKey],
  )
  const [selectedEodWeekKey, setSelectedEodWeekKey] = useState<string>(currentWeekKey)

  const todaysSnapshots = useMemo(() => snapshots.filter((s) => s.dateKey === todayKey), [snapshots, todayKey])
  const lastSnapshotLabel = useMemo(() => {
    if (todaysSnapshots.length === 0) return 'N/A'
    const sorted = [...todaysSnapshots].sort(
      (a, b) =>
        new Date(normalizeIsoTimestamp(b.updatedAt)).getTime() -
        new Date(normalizeIsoTimestamp(a.updatedAt)).getTime()
    )
    return formatTimestamp(sorted[0].updatedAt)
  }, [todaysSnapshots])

  const liveByAgent = useMemo(() => {
    const map = new Map<string, Snapshot>()
    for (const agent of activeAgents) {
      const items = todaysSnapshots
        .filter((s) => s.agentId === agent.id)
        .sort(
          (a, b) =>
            new Date(normalizeIsoTimestamp(b.updatedAt)).getTime() -
            new Date(normalizeIsoTimestamp(a.updatedAt)).getTime()
        )
      const chosen = items.length > 0 ? items[0] : null
      if (chosen) map.set(agent.id, chosen)
    }
    return map
  }, [activeAgents, todaysSnapshots])

  const houseLive = useMemo(() => {
    let totalCalls = 0
    let totalSales = 0
    for (const snap of liveByAgent.values()) {
      totalCalls += snap.billableCalls
      totalSales += snap.sales
    }
    const marketing =
      houseMarketing?.dateKey === todayKey
        ? Number(houseMarketing.amount)
        : computeMetrics(totalCalls, totalSales).marketing
    const cpa = totalSales > 0 ? marketing / totalSales : null
    const cvr = totalCalls > 0 ? totalSales / totalCalls : null
    return { totalCalls, totalSales, marketing, cpa, cvr }
  }, [liveByAgent, todayKey, houseMarketing])

  const agentPerformanceRows = useMemo(() => {
    const rows = activeAgents.map((agent) => {
      const snap = liveByAgent.get(agent.id)
      const calls = snap?.billableCalls ?? 0
      const sales = snap?.sales ?? 0
      const fallbackMetrics = computeMetrics(calls, sales)
      const marketing = snap?.marketing ?? fallbackMetrics.marketing
      const cpa = sales > 0 ? marketing / sales : marketing
      const cvr = calls > 0 ? sales / calls : null
      return {
        agentId: agent.id,
        agentName: agent.name,
        calls,
        sales,
        marketing,
        cpa,
        cvr,
      }
    })
    return rows.sort((a, b) => (b.cpa ?? -Infinity) - (a.cpa ?? -Infinity))
  }, [activeAgents, liveByAgent])

  useEffect(() => {
    const tryFreeze = (): void => {
      const p = estParts(new Date())
      if (p.hour < 23 || (p.hour === 23 && p.minute < 50)) return
      const dateKey = estDateKey(new Date())
      if (perfHistory.some((r) => r.dateKey === dateKey)) return
      const frozenRows: PerfHistory[] = []
      for (const agent of activeAgents) {
        const exact5pm = snapshots.find((s) => s.dateKey === dateKey && s.slot === '17:00' && s.agentId === agent.id)
        const latest = snapshots
          .filter((s) => s.dateKey === dateKey && s.agentId === agent.id)
          .sort((a, b) => SLOT_CONFIG.findIndex((x) => x.key === b.slot) - SLOT_CONFIG.findIndex((x) => x.key === a.slot))[0]
        const source = exact5pm ?? latest
        if (!source) continue
        const m = computeMetrics(source.billableCalls, source.sales)
        frozenRows.push({
          id: uid('perf'),
          dateKey,
          agentId: agent.id,
          billableCalls: source.billableCalls,
          sales: source.sales,
          marketing: m.marketing,
          cpa: m.cpa,
          cvr: m.cvr,
          frozenAt: new Date().toISOString(),
        })
      }
      if (frozenRows.length > 0) setPerfHistory((prev) => [...prev, ...frozenRows])
    }
    tryFreeze()
    const id = window.setInterval(tryFreeze, 60_000)
    return () => window.clearInterval(id)
  }, [activeAgents, perfHistory, setPerfHistory, snapshots])

  const actionQa = useMemo(() => qaRecords.filter((q) => q.status === 'Check Recording'), [qaRecords])
  const actionAudit = useMemo(
    () =>
      auditRecords.filter(
        (a) =>
          a.currentStatus !== 'pending_cms' &&
          a.currentStatus !== 'no_action_needed' &&
          a.currentStatus !== 'accepted' &&
          !(a.mgmtNotified && a.outreachMade),
      ),
    [auditRecords],
  )
  const incompleteQaAgentsToday = useMemo(() => {
    const completed = new Set(qaRecords.filter((r) => r.dateKey === todayKey).map((r) => r.agentId))
    return activeAgents.filter((agent) => !completed.has(agent.id))
  }, [activeAgents, qaRecords, todayKey])
  const incompleteAuditAgentsToday = useMemo(() => {
    const completed = new Set(auditRecords.filter((r) => r.discoveryTs.slice(0, 10) === todayKey).map((r) => r.agentId))
    return activeAgents.filter((agent) => !completed.has(agent.id))
  }, [activeAgents, auditRecords, todayKey])

  const floorCapacity = useMemo(() => {
    const entries = attendance.filter((a) => a.weekKey === currentWeekKey && activeAgents.some((x) => x.id === a.agentId))
    return entries.reduce((acc, a) => acc + a.percent, 0) / 100
  }, [attendance, currentWeekKey, activeAgents])
  const weekTarget = useMemo(() => weeklyTargets.find((w) => w.weekKey === currentWeekKey) ?? null, [weeklyTargets, currentWeekKey])
  const weekTrend = useMemo(() => {
    let totalSales = 0
    let totalMarketing = 0
    let todayMarketingFromAgents = 0
    for (const dateKey of weekDates) {
      for (const agent of activeAgents) {
        const perf = perfHistory.find((p) => p.dateKey === dateKey && p.agentId === agent.id)
        if (perf) {
          totalSales += perf.sales
          if (dateKey !== todayKey) totalMarketing += perf.marketing
          else todayMarketingFromAgents += perf.marketing
          continue
        }
        if (dateKey === todayKey) {
          const snap17 = snapshots.find(
            (s) => s.dateKey === todayKey && s.slot === '17:00' && s.agentId === agent.id,
          )
          const snap = snap17 ?? liveByAgent.get(agent.id)
          if (snap) {
            totalSales += snap.sales
            todayMarketingFromAgents += snap.marketing ?? snap.billableCalls * 15
          }
          continue
        }
        const snap17 = snapshots.find(
          (s) => s.dateKey === dateKey && s.slot === '17:00' && s.agentId === agent.id,
        )
        if (snap17) {
          totalSales += snap17.sales
          totalMarketing += snap17.marketing ?? snap17.billableCalls * 15
        }
      }
      if (dateKey === todayKey) {
        totalMarketing += houseMarketing?.dateKey === todayKey ? Number(houseMarketing.amount) : todayMarketingFromAgents
      }
    }
    const currentCpa = totalSales > 0 ? totalMarketing / totalSales : null
    const salesProgress = weekTarget && weekTarget.targetSales > 0 ? Math.min((totalSales / weekTarget.targetSales) * 100, 100) : null
    const cpaTarget = weekTarget?.targetCpa ?? null
    const cpaDelta = currentCpa === null || cpaTarget === null ? null : currentCpa - cpaTarget
    return { totalSales, currentCpa, salesProgress, cpaTarget, cpaDelta }
  }, [activeAgents, houseMarketing, liveByAgent, perfHistory, snapshots, todayKey, weekDates, weekTarget])

  const currentMinuteOfDay = est.hour * 60 + est.minute
  const attendanceSubmittedToday = useMemo(
    () => attendanceSubmissions.some((submission) => submission.dateKey === todayKey),
    [attendanceSubmissions, todayKey],
  )
  const attendanceAlert = currentMinuteOfDay >= 17 * 60 + 30 && activeAgents.length > 0 && !attendanceSubmittedToday
  const effectiveMetricsAgentId = useMemo(
    () => (activeAgents.some((a) => a.id === metricsAgentId) ? metricsAgentId : activeAgents[0]?.id ?? ''),
    [activeAgents, metricsAgentId],
  )
  const effectiveMetricsDateKey = metricsDateStart ?? todayKey
  const metricsScopeData = useMemo(() => {
    const activeIds = new Set(activeAgents.map((agent) => agent.id))
    const inScope = (agentId: string): boolean =>
      activeIds.has(agentId) && (metricsScope === 'house' || (metricsScope === 'agent' && agentId === effectiveMetricsAgentId))
    const scopeAgents = activeAgents.filter((a) => inScope(a.id))

    const snapshot17 = (dateKey: string, agentId: string): Snapshot | undefined =>
      snapshots.find((s) => s.dateKey === dateKey && s.slot === '17:00' && s.agentId === agentId)
    const perfRow = (dateKey: string, agentId: string): PerfHistory | undefined =>
      perfHistory.find((p) => p.dateKey === dateKey && p.agentId === agentId)

    const toPerfRow = (dateKey: string, snap: Snapshot): PerfHistory => {
      const m = computeMetrics(snap.billableCalls, snap.sales)
      return {
        id: snap.id,
        dateKey,
        agentId: snap.agentId,
        billableCalls: snap.billableCalls,
        sales: snap.sales,
        marketing: m.marketing,
        cpa: m.cpa,
        cvr: m.cvr,
        frozenAt: '',
      }
    }

    const rowForDayAgent = (dateKey: string, agentId: string): PerfHistory | null => {
      if (dateKey === todayKey) {
        const snap = liveByAgent.get(agentId)
        if (snap) return toPerfRow(dateKey, snap)
      }
      const snap17 = snapshot17(dateKey, agentId)
      if (snap17) return toPerfRow(dateKey, snap17)
      const p = perfRow(dateKey, agentId)
      return p ?? null
    }

    const dailyRows: PerfHistory[] = []
    for (const agent of scopeAgents) {
      const row = rowForDayAgent(effectiveMetricsDateKey, agent.id)
      if (row) dailyRows.push(row)
    }

    const metricsWeekDates = monFriDatesForWeek(weekKeyFromDateKey(effectiveMetricsDateKey))
    const weeklyRows: PerfHistory[] = []
    for (const dateKey of metricsWeekDates) {
      for (const agent of scopeAgents) {
        const row = rowForDayAgent(dateKey, agent.id)
        if (row) weeklyRows.push(row)
      }
    }

    const monthPrefix = effectiveMetricsDateKey.slice(0, 7)
    const year = Number(effectiveMetricsDateKey.slice(0, 4))
    const month = Number(effectiveMetricsDateKey.slice(5, 7))
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthDates = Array.from(
      { length: daysInMonth },
      (_, i) => `${monthPrefix}-${String(i + 1).padStart(2, '0')}`,
    )
    const monthlyRows: PerfHistory[] = []
    for (const dateKey of monthDates) {
      for (const agent of scopeAgents) {
        const row = rowForDayAgent(dateKey, agent.id)
        if (row) monthlyRows.push(row)
      }
    }

    const aggregate = (rows: PerfHistory[]) => {
      const calls = rows.reduce((acc, r) => acc + r.billableCalls, 0)
      const sales = rows.reduce((acc, r) => acc + r.sales, 0)
      const marketing = rows.reduce((acc, r) => acc + r.marketing, 0)
      const cpa = sales > 0 ? marketing / sales : marketing
      const cvr = calls > 0 ? sales / calls : null
      return { calls, sales, marketing, cpa, cvr }
    }

    const result: {
      daily: { sales: number; cpa: number | null; cvr: number | null }
      weekly: { sales: number; cpa: number | null; cvr: number | null }
      monthly: { sales: number; cpa: number | null; cvr: number | null }
      custom?: { sales: number; cpa: number | null; cvr: number | null }
    } = {
      daily: aggregate(dailyRows),
      weekly: aggregate(weeklyRows),
      monthly: aggregate(monthlyRows),
    }

    if (metricsDateStart && metricsDateEnd && metricsDateStart !== metricsDateEnd) {
      const rangeDates = dateKeysBetween(metricsDateStart, metricsDateEnd)
      const customRows: PerfHistory[] = []
      for (const dateKey of rangeDates) {
        for (const agent of scopeAgents) {
          const row = rowForDayAgent(dateKey, agent.id)
          if (row) customRows.push(row)
        }
      }
      result.custom = aggregate(customRows)
    }

    return result
  }, [metricsScope, effectiveMetricsAgentId, perfHistory, snapshots, todayKey, liveByAgent, activeAgents, effectiveMetricsDateKey, metricsDateStart, metricsDateEnd])

  const buildRankBaseByAgent = useCallback(
    (
      dateStart: string | null,
      dateEnd: string | null,
    ): { byAgent: Map<string, { calls: number; sales: number; marketing: number }>; periodDates: Set<string> } => {
      const activeIds = new Set(activeAgents.map((agent) => agent.id))
      const byAgent = new Map<string, { calls: number; sales: number; marketing: number }>()
      let periodDates: Set<string>
      if (dateStart && dateEnd && dateStart !== dateEnd) {
        periodDates = new Set(dateKeysBetween(dateStart, dateEnd))
      } else if (dateStart) {
        periodDates = new Set([dateStart])
      } else {
        periodDates = new Set([effectiveMetricsDateKey])
      }
      for (const row of perfHistory.filter((x) => periodDates.has(x.dateKey) && activeIds.has(x.agentId))) {
        if (row.dateKey === todayKey && liveByAgent.has(row.agentId)) continue
        const existing = byAgent.get(row.agentId) ?? { calls: 0, sales: 0, marketing: 0 }
        existing.calls += row.billableCalls
        existing.sales += row.sales
        existing.marketing += row.marketing
        byAgent.set(row.agentId, existing)
      }
      // Fallback: use 17:00 snapshots for dates in range when perfHistory is missing (e.g. before eod.py freeze)
      for (const dateKey of periodDates) {
        if (dateKey === todayKey) continue
        for (const snap of snapshots) {
          if (snap.dateKey !== dateKey || snap.slot !== '17:00' || !activeIds.has(snap.agentId)) continue
          const hasPerf = perfHistory.some((p) => p.dateKey === dateKey && p.agentId === snap.agentId)
          if (hasPerf) continue
          const existing = byAgent.get(snap.agentId) ?? { calls: 0, sales: 0, marketing: 0 }
          existing.calls += snap.billableCalls
          existing.sales += snap.sales
          existing.marketing += snap.marketing ?? snap.billableCalls * 15
          byAgent.set(snap.agentId, existing)
        }
      }
      if (periodDates.has(todayKey)) {
        for (const [agentId, snap] of liveByAgent.entries()) {
          if (!activeIds.has(agentId)) continue
          const existing = byAgent.get(agentId) ?? { calls: 0, sales: 0, marketing: 0 }
          existing.calls += snap.billableCalls
          existing.sales += snap.sales
          existing.marketing += snap.marketing ?? snap.billableCalls * 15
          byAgent.set(agentId, existing)
        }
      }
      return { byAgent, periodDates }
    },
    [activeAgents, effectiveMetricsDateKey, liveByAgent, perfHistory, snapshots, todayKey],
  )

  const rankRows = useMemo(() => {
    const { byAgent } = buildRankBaseByAgent(metricsDateStart, metricsDateEnd)
    const rows = activeAgents.map((agent) => {
      const t = byAgent.get(agent.id) ?? { calls: 0, sales: 0, marketing: 0 }
      return {
        agentId: agent.id,
        agentName: agent.name,
        sales: t.sales,
        cpa: t.sales > 0 ? t.marketing / t.sales : t.marketing,
        cvr: t.calls > 0 ? t.sales / t.calls : null,
      }
    })
    rows.sort((a, b) => {
      if (rankMetric === 'Sales') return b.sales - a.sales
      if (rankMetric === 'CVR') return (b.cvr ?? -1) - (a.cvr ?? -1)
      return (a.cpa ?? Number.POSITIVE_INFINITY) - (b.cpa ?? Number.POSITIVE_INFINITY)
    })
    return rows
  }, [activeAgents, buildRankBaseByAgent, rankMetric, metricsDateStart, metricsDateEnd])

  const rankRowsTransferAdjusted = useMemo(() => {
    const { byAgent, periodDates } = buildRankBaseByAgent(metricsDateStart, metricsDateEnd)

    const salesDeltaByAgent = new Map<string, number>()
    const inPeriod = (dateKey: string): boolean => periodDates.has(dateKey)

    const relevantTransfers: TransferRecord[] = transfers.filter((t) => inPeriod(t.dateKey))

    for (const t of relevantTransfers) {
      salesDeltaByAgent.set(t.fromAgentId, (salesDeltaByAgent.get(t.fromAgentId) ?? 0) + 1)
      salesDeltaByAgent.set(t.toAgentId, (salesDeltaByAgent.get(t.toAgentId) ?? 0) - 1)
    }

    const rows = activeAgents.map((agent) => {
      const base = byAgent.get(agent.id) ?? { calls: 0, sales: 0, marketing: 0 }
      const delta = salesDeltaByAgent.get(agent.id) ?? 0
      const adjustedSalesForCpa = base.sales + delta
      const adjustedCpa = adjustedSalesForCpa > 0 ? base.marketing / adjustedSalesForCpa : null
      const cvr = base.calls > 0 ? base.sales / base.calls : null
      return {
        agentId: agent.id,
        agentName: agent.name,
        sales: base.sales,
        cpa: adjustedCpa,
        cvr,
      }
    })

    rows.sort((a, b) => {
      if (rankMetric === 'Sales') return b.sales - a.sales
      if (rankMetric === 'CVR') return (b.cvr ?? -1) - (a.cvr ?? -1)
      const aCpa = a.cpa ?? Number.POSITIVE_INFINITY
      const bCpa = b.cpa ?? Number.POSITIVE_INFINITY
      return aCpa - bCpa
    })

    return rows
  }, [activeAgents, buildRankBaseByAgent, metricsDateEnd, metricsDateStart, transfers, rankMetric])

  const activeIds = useMemo(() => new Set(activeAgents.map((agent) => agent.id)), [activeAgents])
  const metricsMonthPrefix = effectiveMetricsDateKey.slice(0, 7)
  const metricsWeekDatesForPeriod = useMemo(
    () => monFriDatesForWeek(weekKeyFromDateKey(effectiveMetricsDateKey)),
    [effectiveMetricsDateKey],
  )
  const isInKpiPeriod = useCallback(
    (dateKey: string): boolean => {
      if (metricsDateStart && metricsDateEnd && metricsDateStart !== metricsDateEnd) {
        return dateKey >= metricsDateStart && dateKey <= metricsDateEnd
      }
      if (kpiPeriod === 'day') return dateKey === effectiveMetricsDateKey
      if (kpiPeriod === 'week') return metricsWeekDatesForPeriod.includes(dateKey)
      return dateKey.startsWith(metricsMonthPrefix)
    },
    [kpiPeriod, effectiveMetricsDateKey, metricsWeekDatesForPeriod, metricsMonthPrefix, metricsDateStart, metricsDateEnd],
  )

  const qaPassRate = useMemo(() => {
    const rows = qaRecords.filter((record) => {
      if (!activeIds.has(record.agentId)) return false
      if (metricsScope === 'agent' && record.agentId !== effectiveMetricsAgentId) return false
      return isInKpiPeriod(record.dateKey)
    })
    if (rows.length === 0) return null
    return rows.filter((r) => r.decision === 'Good Sale').length / rows.length
  }, [qaRecords, activeIds, metricsScope, effectiveMetricsAgentId, isInKpiPeriod])
  const auditRecoveryHours = useMemo(() => {
    const rows = auditRecords.filter((record) => {
      if (!record.resolutionTs) return false
      if (!activeIds.has(record.agentId)) return false
      if (metricsScope === 'agent' && record.agentId !== effectiveMetricsAgentId) return false
      return isInKpiPeriod(record.discoveryTs.slice(0, 10))
    })
    if (rows.length === 0) return null
    const sum = rows.reduce(
      (acc, row) =>
        acc + Math.max(0, (new Date(row.resolutionTs!).getTime() - new Date(row.discoveryTs).getTime()) / 3_600_000),
      0,
    )
    return sum / rows.length
  }, [auditRecords, activeIds, metricsScope, effectiveMetricsAgentId, isInKpiPeriod])
  const activeAuditCount = useMemo(() => {
    return auditRecords.filter((record) => {
      if (!activeIds.has(record.agentId)) return false
      if (metricsScope === 'agent' && record.agentId !== effectiveMetricsAgentId) return false
      if (record.currentStatus === 'no_action_needed') return false
      if (record.mgmtNotified && record.outreachMade) return false
      return isInKpiPeriod(record.discoveryTs.slice(0, 10))
    }).length
  }, [auditRecords, activeIds, metricsScope, effectiveMetricsAgentId, isInKpiPeriod])

  const eodWeekOptions = useMemo(() => {
    const startWeekKey = weekKeyFromDateKey(EOD_VIEWS_START_DATE_KEY)
    const weekKeys: string[] = []
    const [y, m, d] = startWeekKey.split('-').map(Number)
    let monday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    while (true) {
      const key = weekKeyMonFri(monday)
      if (key > currentWeekKey) break
      weekKeys.push(key)
      monday.setUTCDate(monday.getUTCDate() + 7)
    }
    if (weekKeys.length === 0) {
      weekKeys.push(currentWeekKey)
    }
    weekKeys.sort((a, b) => b.localeCompare(a))
    return weekKeys.map((weekKey, idx) => {
      const label =
        weekKey === currentWeekKey
          ? 'Current Week'
          : idx === 1
            ? 'Last Week'
            : idx > 1 && idx < 8
              ? `${idx} Weeks Ago`
              : formatWeekRangeLabel(weekKey)
      return { weekKey, label }
    })
  }, [currentWeekKey])

  const effectiveEodWeekKey = useMemo(
    () =>
      eodWeekOptions.some((option) => option.weekKey === selectedEodWeekKey) ? selectedEodWeekKey : currentWeekKey,
    [currentWeekKey, eodWeekOptions, selectedEodWeekKey],
  )

  const eodDateTotals = useMemo(() => {
    const dates = monFriDatesForWeek(effectiveEodWeekKey)
    const totalsByDate = new Map<string, { deals: number; marketing: number; updatedAt: string | null }>()
    for (const dateKey of dates) {
      let deals = 0
      let marketing = 0
      let updatedAt: string | null = null
      const setLatest = (ts: string) => {
        if (!updatedAt || new Date(normalizeIsoTimestamp(ts)).getTime() > new Date(normalizeIsoTimestamp(updatedAt)).getTime()) updatedAt = ts
      }
      for (const agent of activeAgents) {
        const perf = perfHistory.find((p) => p.dateKey === dateKey && p.agentId === agent.id)
        if (perf) {
          deals += perf.sales
          marketing += perf.marketing
          setLatest(perf.frozenAt)
          continue
        }
        if (dateKey === todayKey) {
          const snap = liveByAgent.get(agent.id)
          if (snap) {
            deals += snap.sales
            marketing += snap.marketing ?? snap.billableCalls * 15
            setLatest(snap.updatedAt)
          }
          continue
        }
        const snap17 = snapshots.find(
          (s) => s.dateKey === dateKey && s.slot === '17:00' && s.agentId === agent.id,
        )
        if (snap17) {
          deals += snap17.sales
          marketing += snap17.marketing ?? snap17.billableCalls * 15
          setLatest(snap17.updatedAt)
          continue
        }
      }
      if (dateKey === todayKey && houseMarketing?.dateKey === todayKey) {
        marketing = Number(houseMarketing.amount)
      }
      totalsByDate.set(dateKey, { deals, marketing, updatedAt })
    }
    return totalsByDate
  }, [activeAgents, effectiveEodWeekKey, houseMarketing, liveByAgent, perfHistory, snapshots, todayKey])

  const eodTodayTotals = useMemo(() => {
    const dateKey = todayKey
    let sales = 0
    let marketing = 0
    for (const agent of activeAgents) {
      const perf = perfHistory.find((p) => p.dateKey === dateKey && p.agentId === agent.id)
      if (perf) {
        sales += perf.sales
        marketing += perf.marketing
        continue
      }
      const snap = liveByAgent.get(agent.id)
      if (snap) {
        sales += snap.sales
        marketing += snap.marketing ?? snap.billableCalls * 15
        continue
      }
      const snap17 = snapshots.find(
        (s) => s.dateKey === dateKey && s.slot === '17:00' && s.agentId === agent.id,
      )
      if (snap17) {
        sales += snap17.sales
        marketing += snap17.marketing ?? snap17.billableCalls * 15
      }
    }
    if (houseMarketing?.dateKey === todayKey) {
      marketing = Number(houseMarketing.amount)
    }
    const cpa = sales > 0 ? marketing / sales : null
    return { sales, marketing, cpa }
  }, [activeAgents, houseMarketing, liveByAgent, perfHistory, snapshots, todayKey])

  const eodHistoryDays = useMemo(() => {
    const dateKeys = new Set<string>()
    for (const r of eodReports) dateKeys.add(r.dateKey)
    for (const p of perfHistory) dateKeys.add(p.dateKey)
    for (const s of snapshots) {
      if (s.slot === '17:00') dateKeys.add(s.dateKey)
    }
    const days = Array.from(dateKeys).sort((a, b) => b.localeCompare(a))
    return days.map((dateKey) => {
      const reportsForDay = eodReports.filter((r) => r.dateKey === dateKey)
      const latestReport = reportsForDay.length > 0
        ? reportsForDay.sort((a, b) => (b.submittedAt > a.submittedAt ? 1 : -1))[0]
        : null
      const perfForDay = perfHistory.filter((p) => p.dateKey === dateKey)
      const snapsForDay = snapshots.filter((s) => s.dateKey === dateKey && s.slot === '17:00')
      let houseSales = latestReport?.houseSales ?? 0
      let houseCpa = latestReport?.houseCpa ?? null
      if (!latestReport && perfForDay.length > 0) {
        const totalSales = perfForDay.reduce((acc, p) => acc + p.sales, 0)
        const totalMarketing = perfForDay.reduce((acc, p) => acc + p.marketing, 0)
        houseSales = totalSales
        houseCpa = totalSales > 0 ? totalMarketing / totalSales : null
      }
      if (!latestReport && perfForDay.length === 0 && snapsForDay.length > 0) {
        houseSales = snapsForDay.reduce((acc, s) => acc + s.sales, 0)
        const totalMkt = snapsForDay.reduce((acc, s) => acc + (s.marketing ?? s.billableCalls * 15), 0)
        houseCpa = houseSales > 0 ? totalMkt / houseSales : null
      }
      const agentRows =
        perfForDay.length > 0
          ? perfForDay.map((p) => {
              const agent = agents.find((a) => a.id === p.agentId)
              return {
                agentId: p.agentId,
                agentName: agent?.name ?? p.agentId,
                calls: p.billableCalls,
                sales: p.sales,
                marketing: p.marketing,
                cpa: p.cpa,
                cvr: p.cvr,
              }
            })
          : snapsForDay.map((s) => {
              const agent = agents.find((a) => a.id === s.agentId)
              const marketing = s.marketing ?? s.billableCalls * 15
              const cpa = s.sales > 0 ? marketing / s.sales : null
              const cvr = s.billableCalls > 0 ? s.sales / s.billableCalls : null
              return {
                agentId: s.agentId,
                agentName: agent?.name ?? s.agentId,
                calls: s.billableCalls,
                sales: s.sales,
                marketing,
                cpa,
                cvr,
              }
            })
      return {
        dateKey,
        houseSales,
        houseCpa,
        reportText: latestReport?.reportText?.trim() ?? undefined,
        submittedAt: latestReport?.submittedAt,
        agentRows,
      }
    })
  }, [agents, eodReports, perfHistory, snapshots])

  const eodWeeklyRows = useMemo(() => {
    const dates = monFriDatesForWeek(effectiveEodWeekKey)
    return dates.map((dateKey, idx) => {
      const totals = eodDateTotals.get(dateKey) ?? { deals: 0, marketing: 0, updatedAt: null }
      return {
        dayLabel: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][idx],
        dateKey,
        deals: totals.deals,
        marketing: totals.marketing,
        cpa: totals.deals > 0 ? totals.marketing / totals.deals : null,
        updatedAt: totals.updatedAt,
      }
    })
  }, [effectiveEodWeekKey, eodDateTotals])

  const eodWeeklySummary = useMemo(() => {
    const fridayKey = monFriDatesForWeek(effectiveEodWeekKey)[4]
    const summary = eodWeeklyRows.reduce(
      (acc, row) => {
        acc.deals += row.deals
        acc.marketing += row.marketing
        if (row.updatedAt && (!acc.updatedAt || new Date(normalizeIsoTimestamp(row.updatedAt)).getTime() > new Date(normalizeIsoTimestamp(acc.updatedAt)).getTime())) {
          acc.updatedAt = row.updatedAt
        }
        return acc
      },
      { deals: 0, marketing: 0, updatedAt: null as string | null },
    )
    const isAfterFridayCutoff = fridayKey < todayKey || (fridayKey === todayKey && currentMinuteOfDay >= 18 * 60 + 15)
    return {
      ...summary,
      cpa: summary.deals > 0 ? summary.marketing / summary.deals : null,
      finalized: isAfterFridayCutoff,
    }
  }, [currentMinuteOfDay, effectiveEodWeekKey, eodWeeklyRows, todayKey])

  const monthLabel = useMemo(() => {
    const parts = effectiveEodWeekKey.split('-').map(Number)
    const date = new Date(Date.UTC(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1))
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
  }, [effectiveEodWeekKey])

  const effectiveVaultAgentId = useMemo(
    () => (activeAgents.some((a) => a.id === vaultAgentId) ? vaultAgentId : activeAgents[0]?.id ?? ''),
    [activeAgents, vaultAgentId],
  )
  const selectedVaultAgent = useMemo(
    () => agents.find((a) => a.id === effectiveVaultAgentId) ?? null,
    [agents, effectiveVaultAgentId],
  )
  const sortNewest = historySort === 'newest'

  const vaultAttendanceHistory = useMemo(
    () =>
      attendance
        .filter((a) => vaultScope === 'house' || (!!selectedVaultAgent && selectedVaultAgent.id === a.agentId))
        .sort((a, b) => (sortNewest ? b.dateKey.localeCompare(a.dateKey) : a.dateKey.localeCompare(b.dateKey))),
    [attendance, selectedVaultAgent, vaultScope, sortNewest],
  )
  const vaultQaHistory = useMemo(
    () =>
      qaRecords
        .filter((q) => vaultScope === 'house' || (!!selectedVaultAgent && selectedVaultAgent.id === q.agentId))
        .sort((a, b) => (sortNewest ? b.dateKey.localeCompare(a.dateKey) : a.dateKey.localeCompare(b.dateKey))),
    [qaRecords, selectedVaultAgent, vaultScope, sortNewest],
  )
  const vaultAuditHistory = useMemo(
    () =>
      auditRecords
        .filter((a) => vaultScope === 'house' || (!!selectedVaultAgent && selectedVaultAgent.id === a.agentId))
        .sort((a, b) =>
          sortNewest
            ? new Date(b.discoveryTs).getTime() - new Date(a.discoveryTs).getTime()
            : new Date(a.discoveryTs).getTime() - new Date(b.discoveryTs).getTime(),
        ),
    [auditRecords, selectedVaultAgent, vaultScope, sortNewest],
  )
  const weeklyTargetHistory = useMemo(
    () =>
      [...weeklyTargets]
        .sort((a, b) => (sortNewest ? b.weekKey.localeCompare(a.weekKey) : a.weekKey.localeCompare(b.weekKey)))
        .map((target) => {
          const dates = monFriDatesForWeek(target.weekKey)
          const isCurrentWeek = target.weekKey === currentWeekKey
          let actualSales = 0
          let actualMarketing = 0
          for (const row of perfHistory) {
            if (!dates.includes(row.dateKey)) continue
            if (isCurrentWeek && row.dateKey === todayKey && liveByAgent.has(row.agentId)) continue
            actualSales += row.sales
            actualMarketing += row.marketing
          }
          if (isCurrentWeek) {
            for (const snap of liveByAgent.values()) {
              actualSales += snap.sales
              actualMarketing += snap.marketing ?? snap.billableCalls * 15
            }
          }
          const actualCpa = actualSales > 0 ? actualMarketing / actualSales : null
          const salesDeltaPct =
            target.targetSales > 0 ? ((actualSales - target.targetSales) / target.targetSales) * 100 : null
          const cpaDeltaPct =
            target.targetCpa > 0 && actualCpa !== null
              ? ((actualCpa - target.targetCpa) / target.targetCpa) * 100
              : null
          return {
            weekKey: target.weekKey,
            targetSales: target.targetSales,
            targetCpa: target.targetCpa,
            actualSales,
            actualCpa,
            salesHit: actualSales >= target.targetSales,
            cpaHit: actualCpa !== null ? actualCpa <= target.targetCpa : false,
            salesDeltaPct,
            cpaDeltaPct,
            setAt: target.setAt,
          }
        }),
    [weeklyTargets, perfHistory, currentWeekKey, liveByAgent, sortNewest, todayKey],
  )

  const upsertSnapshot = (slot: SlotConfig, agentId: string, calls: number, sales: number): void => {
    setSnapshots((prev) => {
      const existing = prev.find((s) => s.dateKey === todayKey && s.slot === slot.key && s.agentId === agentId)
      if (existing) {
        return prev.map((s) =>
          s.id === existing.id
            ? { ...s, billableCalls: calls, sales, updatedAt: new Date().toISOString() }
            : s,
        )
      }
      return [
        ...prev,
        {
          id: uid('snap'),
          dateKey: todayKey,
          slot: slot.key,
          slotLabel: slot.label,
          agentId,
          billableCalls: calls,
          sales,
          marketing: null,
          updatedAt: new Date().toISOString(),
        },
      ]
    })
  }

  return {
    now,
    est,
    todayKey,
    currentWeekKey,
    weekDates,
    selectedAttendanceWeekKey: effectiveAttendanceWeekKey,
    setSelectedAttendanceWeekKey,
    attendanceWeekDates,
    attendanceWeekOptions,
    activeAgents,
    agents,
    todaysSnapshots,
    lastSnapshotLabel,
    liveByAgent,
    houseLive,
    agentPerformanceRows,
    actionQa,
    actionAudit,
    incompleteQaAgentsToday,
    incompleteAuditAgentsToday,
    floorCapacity,
    weekTarget,
    weekTrend,
    attendanceAlert,
    taskPage,
    setTaskPage,
    selectedEodWeekKey: effectiveEodWeekKey,
    setSelectedEodWeekKey,
    eodWeekOptions,
    eodWeeklyRows,
    eodWeeklySummary,
    eodTodayTotals,
    eodHistoryDays,
    monthLabel,
    metricsScope,
    setMetricsScope,
    metricsAgentId,
    setMetricsAgentId,
    effectiveMetricsAgentId,
    metricsScopeData,
    rankRows,
    rankRowsTransferAdjusted,
    rankMetric,
    setRankMetric,
    rankPeriod,
    setRankPeriod,
    kpiPeriod,
    setKpiPeriod,
    metricsDateStart,
    metricsDateEnd,
    setMetricsDateStart,
    setMetricsDateEnd,
    qaPassRate,
    auditRecoveryHours,
    activeAuditCount,
    vaultAgentId,
    setVaultAgentId,
    vaultHistoryView,
    setVaultHistoryView,
    vaultScope,
    setVaultScope,
    historySort,
    setHistorySort,
    effectiveVaultAgentId,
    selectedVaultAgent,
    vaultAttendanceHistory,
    vaultQaHistory,
    vaultAuditHistory,
    weeklyTargetHistory,
    snapshots,
    attendanceSubmissions,
    intraSubmissions,
    store,
    upsertSnapshot,
  }
}
