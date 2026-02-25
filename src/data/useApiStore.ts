import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import type {
  Agent,
  AttendanceRecord,
  AttendanceSubmission,
  AuditRecord,
  IntraSubmission,
  PerfHistory,
  QaRecord,
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
  const [loggedIn, setLoggedInState] = useState(false)
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
  const [vaultMeetingsState, setVaultMeetingsState] = useState<VaultMeeting[]>([])
  const [vaultDocsState, setVaultDocsState] = useState<VaultDoc[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [lastPoliciesBotRun, setLastPoliciesBotRun] = useState<string | null>(null)
  const loadFromApi = useCallback(async () => {
    try {
      const me = await client.me()
      setLoggedInState(me)
      if (!me) {
        hasLoadedRemoteRef.current = false
        setError(null)
        return
      }
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
      setVaultMeetingsState(state.vaultMeetings)
      setVaultDocsState(state.vaultDocs)
      setLastPoliciesBotRun(state.lastPoliciesBotRun ?? null)
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
  const setVaultMeetings = wrapSetter(setVaultMeetingsState)
  const setVaultDocs = wrapSetter(setVaultDocsState)

  const login = useCallback(
    async (username: string, password: string) => {
      hydratingRef.current = true
      try {
        await client.login(username, password)
        setLoggedInState(true)
        await loadFromApi()
        setError(null)
      } finally {
        hydratingRef.current = false
      }
    },
    [client, loadFromApi],
  )

  const logout = useCallback(async () => {
    try {
      await client.logout()
      setLoggedInState(false)
      hasLoadedRemoteRef.current = false
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out.')
    }
  }, [client])

  const syncCollection = useCallback(
    async <K extends Parameters<typeof client.putCollection>[0]>(key: K, value: Parameters<typeof client.putCollection<K>>[1]) => {
      if (hydratingRef.current || !loggedIn || !hasLoadedRemoteRef.current) return
      try {
        await client.putCollection(key, value)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync data.')
      }
    },
    [client, loggedIn],
  )

  const pushSnapshotsToApi = useCallback(
    async (snapshots: Snapshot[]) => {
      if (!loggedIn || !hasLoadedRemoteRef.current) return
      try {
        await client.putCollection('snapshots', snapshots)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync data.')
      }
    },
    [client, loggedIn],
  )

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
    if (!loggedIn || !hasLoadedRemoteRef.current) return
    const intervalMs = 5 * 60 * 1000
    const id = window.setInterval(() => {
      void loadFromApi()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [loggedIn, loadFromApi])

  useEffect(() => {
    void syncCollection('agents', agentsState)
  }, [agentsState, syncCollection])
  // Snapshots are written only by the bot; dashboard only reads. Do not sync snapshots
  // back to the API or we can overwrite fresh bot data with stale state after a cached GET.
  useEffect(() => {
    void syncCollection('perfHistory', perfHistoryState)
  }, [perfHistoryState, syncCollection])
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
    lastPoliciesBotRun,
  }
}
