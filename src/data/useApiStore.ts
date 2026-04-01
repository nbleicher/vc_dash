import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import type {
  Agent,
  AttendanceRecord,
  AttendanceSubmission,
  AuditRecord,
  EodReport,
  IntraSubmission,
  PerfHistory,
  QaRecord,
  ShadowLog,
  TransferRecord,
  Snapshot,
  SpiffRecord,
  VaultDoc,
  VaultMeeting,
  WeeklyTarget,
} from '../types'
import type { DataStore } from './store.types'
import { createApiClient } from './apiClient'
import { estDateKey } from '../utils'

type Setter<T> = React.Dispatch<SetStateAction<T>>

function resolveNext<T>(next: SetStateAction<T>, current: T): T {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next
}

export function useDataStore(): DataStore {
  const client = useMemo(() => createApiClient(), [])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedInState] = useState(true)
  const hasLoadedRemoteRef = useRef(false)

  const [agentsState, setAgentsState] = useState<Agent[]>([])
  const [snapshotsState, setSnapshotsState] = useState<Snapshot[]>([])
  const [perfHistoryState, setPerfHistoryState] = useState<PerfHistory[]>([])
  const [qaRecordsState, setQaRecordsState] = useState<QaRecord[]>([])
  const [auditRecordsState, setAuditRecordsState] = useState<AuditRecord[]>([])
  const [attendanceState, setAttendanceState] = useState<AttendanceRecord[]>([])
  const [spiffRecordsState, setSpiffRecordsState] = useState<SpiffRecord[]>([])
  const [attendanceSubmissionsState, setAttendanceSubmissionsState] = useState<AttendanceSubmission[]>([])
  const [intraSubmissionsState, setIntraSubmissionsState] = useState<IntraSubmission[]>([])
  const [weeklyTargetsState, setWeeklyTargetsState] = useState<WeeklyTarget[]>([])
  const [transfersState, setTransfersState] = useState<TransferRecord[]>([])
  const [shadowLogsState, setShadowLogsState] = useState<ShadowLog[]>([])
  const [vaultMeetingsState, setVaultMeetingsState] = useState<VaultMeeting[]>([])
  const [vaultDocsState, setVaultDocsState] = useState<VaultDoc[]>([])
  const [eodReportsState, setEodReportsState] = useState<EodReport[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [lastPoliciesBotRun, setLastPoliciesBotRun] = useState<string | null>(null)
  const [houseMarketing, setHouseMarketing] = useState<{ dateKey: string; amount: number } | null>(null)
  const shadowSyncInFlightRef = useRef(false)
  const shadowSyncQueuedRef = useRef(false)
  const shadowSyncLatestRef = useRef<ShadowLog[]>([])
  const loadFromApi = useCallback(async () => {
    try {
      const state = await client.getState()
      if (import.meta.env.DEV) {
        const todayKey = estDateKey(new Date())
        console.log(
          '[state] snapshots count',
          state.snapshots?.length,
          'today',
          state.snapshots?.filter((s) => s.dateKey === todayKey).length,
        )
      }
      setAgentsState(state.agents)
      setSnapshotsState(state.snapshots)
      setPerfHistoryState(state.perfHistory)
      setQaRecordsState(state.qaRecords)
      setAuditRecordsState(state.auditRecords)
      setAttendanceState(state.attendance)
      setSpiffRecordsState(state.spiffRecords ?? [])
      setAttendanceSubmissionsState(state.attendanceSubmissions ?? [])
      setIntraSubmissionsState(state.intraSubmissions ?? [])
      setWeeklyTargetsState(state.weeklyTargets)
      setTransfersState(state.transfers ?? [])
      setShadowLogsState(state.shadowLogs ?? [])
      setVaultMeetingsState(state.vaultMeetings)
      setVaultDocsState(state.vaultDocs)
      setEodReportsState(state.eodReports ?? [])
      setLastPoliciesBotRun(state.lastPoliciesBotRun ?? null)
      setHouseMarketing(state.houseMarketing ?? null)
      hasLoadedRemoteRef.current = true
      setError(null)
      setLastFetchedAt(new Date().toISOString())
    } catch (err) {
      hasLoadedRemoteRef.current = false
      setError(err instanceof Error ? err.message : 'Failed to load data.')
    }
  }, [client])


  const hydratingRef = useRef(true)

  const wrapSetter = useCallback(
    <T,>(setter: Setter<T>): Setter<T> =>
      (next) => {
        setter((current) => resolveNext(next, current))
      },
    [],
  )

  const setLoggedIn = useCallback<Setter<boolean>>((next) => {
    setLoggedInState((current) => resolveNext(next, current))
  }, [])

  const setAgents = wrapSetter(setAgentsState)
  const setSnapshots = wrapSetter(setSnapshotsState)
  const setPerfHistory = wrapSetter(setPerfHistoryState)
  const setQaRecords = wrapSetter(setQaRecordsState)
  const setAuditRecords = wrapSetter(setAuditRecordsState)
  const setAttendance = wrapSetter(setAttendanceState)
  const setSpiffRecords = wrapSetter(setSpiffRecordsState)
  const setAttendanceSubmissions = wrapSetter(setAttendanceSubmissionsState)
  const setIntraSubmissions = wrapSetter(setIntraSubmissionsState)
  const setWeeklyTargets = wrapSetter(setWeeklyTargetsState)
  const setTransfers = wrapSetter(setTransfersState)
  const setShadowLogs = wrapSetter(setShadowLogsState)
  const setVaultMeetings = wrapSetter(setVaultMeetingsState)
  const setVaultDocs = wrapSetter(setVaultDocsState)
  const setEodReports = wrapSetter(setEodReportsState)

  const login = useCallback(async () => {
    hydratingRef.current = true
    try {
      setLoggedInState(true)
      await loadFromApi()
      setError(null)
    } finally {
      hydratingRef.current = false
    }
  }, [loadFromApi])

  const logout = useCallback(async () => {
    // No-op logout in no-auth mode; keep dashboard accessible
    setLoggedInState(true)
    hasLoadedRemoteRef.current = false
    setError(null)
  }, [])

  const syncCollection = useCallback(
    async <K extends Parameters<typeof client.putCollection>[0]>(key: K, value: Parameters<typeof client.putCollection<K>>[1]) => {
      if (hydratingRef.current || !hasLoadedRemoteRef.current) return
      try {
        await client.putCollection(key, value)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync data.')
      }
    },
    [client],
  )

  const pushSnapshotsToApi = useCallback(
    async (snapshots: Snapshot[]) => {
      if (!hasLoadedRemoteRef.current) return
      try {
        await client.putCollection('snapshots', snapshots)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync data.')
      }
    },
    [client],
  )

  const flushShadowLogsSync = useCallback(async () => {
    if (hydratingRef.current || !hasLoadedRemoteRef.current) return
    shadowSyncLatestRef.current = shadowLogsState
    if (shadowSyncInFlightRef.current) {
      shadowSyncQueuedRef.current = true
      return
    }

    shadowSyncInFlightRef.current = true
    try {
      do {
        shadowSyncQueuedRef.current = false
        try {
          await client.putCollection('shadowLogs', shadowSyncLatestRef.current)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to sync data.')
        }
      } while (shadowSyncQueuedRef.current)
    } finally {
      shadowSyncInFlightRef.current = false
    }
  }, [client, shadowLogsState])

  useEffect(() => {
    const load = async () => {
      try {
        await loadFromApi()
      } finally {
        hydratingRef.current = false
        setIsLoading(false)
      }
    }
    void load()
  }, [loadFromApi])

  // Refetch state every 5 min so dashboard picks up bot snapshot updates
  useEffect(() => {
    if (!hasLoadedRemoteRef.current) return
    const intervalMs = 5 * 60 * 1000
    const id = window.setInterval(() => {
      void loadFromApi()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [loadFromApi])

  useEffect(() => {
    void syncCollection('agents', agentsState)
  }, [agentsState, syncCollection])
  // Snapshots are written only by the bot; dashboard only reads. Do not sync snapshots
  // back to the API or we can overwrite fresh bot data with stale state after a cached GET.
  // perfHistory is written by the EOD bot (eod.py); do not sync
  // from the dashboard or we overwrite corrected EOD totals with stale client state.
  // useEffect(() => {
  //   void syncCollection('perfHistory', perfHistoryState)
  // }, [perfHistoryState, syncCollection])
  useEffect(() => {
    void syncCollection('qaRecords', qaRecordsState)
  }, [qaRecordsState, syncCollection])
  useEffect(() => {
    void syncCollection('auditRecords', auditRecordsState)
  }, [auditRecordsState, syncCollection])
  useEffect(() => {
    void syncCollection('attendance', attendanceState)
  }, [attendanceState, syncCollection])
  useEffect(() => {
    void syncCollection('spiffRecords', spiffRecordsState)
  }, [spiffRecordsState, syncCollection])
  useEffect(() => {
    void syncCollection('attendanceSubmissions', attendanceSubmissionsState)
  }, [attendanceSubmissionsState, syncCollection])
  useEffect(() => {
    void syncCollection('intraSubmissions', intraSubmissionsState)
  }, [intraSubmissionsState, syncCollection])
  useEffect(() => {
    void syncCollection('weeklyTargets', weeklyTargetsState)
  }, [weeklyTargetsState, syncCollection])
  useEffect(() => {
    void syncCollection('vaultMeetings', vaultMeetingsState)
  }, [vaultMeetingsState, syncCollection])
  useEffect(() => {
    void syncCollection('vaultDocs', vaultDocsState)
  }, [vaultDocsState, syncCollection])
  useEffect(() => {
    void syncCollection('eodReports', eodReportsState)
  }, [eodReportsState, syncCollection])
  useEffect(() => {
    void syncCollection('transfers', transfersState)
  }, [transfersState, syncCollection])
  useEffect(() => {
    void flushShadowLogsSync()
  }, [flushShadowLogsSync])

  return {
    loggedIn,
    setLoggedIn,
    login,
    logout,
    reload: async () => {
      setIsLoading(true)
      hydratingRef.current = true
      try {
        await loadFromApi()
      } finally {
        hydratingRef.current = false
        setIsLoading(false)
      }
    },
    lastFetchedAt,
    isLoading,
    error,
    clearError: () => setError(null),
    agents: agentsState,
    setAgents,
    snapshots: snapshotsState,
    setSnapshots,
    pushSnapshotsToApi,
    perfHistory: perfHistoryState,
    setPerfHistory,
    qaRecords: qaRecordsState,
    setQaRecords,
    auditRecords: auditRecordsState,
    setAuditRecords,
    attendance: attendanceState,
    setAttendance,
    transfers: transfersState,
    setTransfers,
    shadowLogs: shadowLogsState,
    setShadowLogs,
    flushShadowLogsSync,
    spiffRecords: spiffRecordsState,
    setSpiffRecords,
    attendanceSubmissions: attendanceSubmissionsState,
    setAttendanceSubmissions,
    intraSubmissions: intraSubmissionsState,
    setIntraSubmissions,
    weeklyTargets: weeklyTargetsState,
    setWeeklyTargets,
    vaultMeetings: vaultMeetingsState,
    setVaultMeetings,
    vaultDocs: vaultDocsState,
    setVaultDocs,
    eodReports: eodReportsState,
    setEodReports,
    lastPoliciesBotRun,
    houseMarketing,
  }
}
