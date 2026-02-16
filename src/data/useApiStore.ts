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
  VaultDoc,
  VaultMeeting,
  WeeklyTarget,
} from '../types'
import type { DataStore } from './store.types'
import { createApiClient } from './apiClient'

type Setter<T> = React.Dispatch<SetStateAction<T>>

function resolveNext<T>(next: SetStateAction<T>, current: T): T {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next
}

export function useDataStore(): DataStore {
  const client = useMemo(() => createApiClient(), [])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedInState] = useState(false)

  const [agentsState, setAgentsState] = useState<Agent[]>([])
  const [snapshotsState, setSnapshotsState] = useState<Snapshot[]>([])
  const [perfHistoryState, setPerfHistoryState] = useState<PerfHistory[]>([])
  const [qaRecordsState, setQaRecordsState] = useState<QaRecord[]>([])
  const [auditRecordsState, setAuditRecordsState] = useState<AuditRecord[]>([])
  const [attendanceState, setAttendanceState] = useState<AttendanceRecord[]>([])
  const [attendanceSubmissionsState, setAttendanceSubmissionsState] = useState<AttendanceSubmission[]>([])
  const [intraSubmissionsState, setIntraSubmissionsState] = useState<IntraSubmission[]>([])
  const [weeklyTargetsState, setWeeklyTargetsState] = useState<WeeklyTarget[]>([])
  const [vaultMeetingsState, setVaultMeetingsState] = useState<VaultMeeting[]>([])
  const [vaultDocsState, setVaultDocsState] = useState<VaultDoc[]>([])
  const loadFromApi = useCallback(async () => {
    try {
      const me = await client.me()
      setLoggedInState(me)
      if (!me) {
        setError(null)
        return
      }
      const state = await client.getState()
      setAgentsState(state.agents)
      setSnapshotsState(state.snapshots)
      setPerfHistoryState(state.perfHistory)
      setQaRecordsState(state.qaRecords)
      setAuditRecordsState(state.auditRecords)
      setAttendanceState(state.attendance)
      setAttendanceSubmissionsState(state.attendanceSubmissions ?? [])
      setIntraSubmissionsState(state.intraSubmissions ?? [])
      setWeeklyTargetsState(state.weeklyTargets)
      setVaultMeetingsState(state.vaultMeetings)
      setVaultDocsState(state.vaultDocs)
      setError(null)
    } catch (err) {
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
  const setAttendanceSubmissions = wrapSetter(setAttendanceSubmissionsState)
  const setIntraSubmissions = wrapSetter(setIntraSubmissionsState)
  const setWeeklyTargets = wrapSetter(setWeeklyTargetsState)
  const setVaultMeetings = wrapSetter(setVaultMeetingsState)
  const setVaultDocs = wrapSetter(setVaultDocsState)

  const login = useCallback(
    async (username: string, password: string) => {
      await client.login(username, password)
      setLoggedInState(true)
      setError(null)
    },
    [client],
  )

  const logout = useCallback(async () => {
    try {
      await client.logout()
      setLoggedInState(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out.')
    }
  }, [client])

  const syncCollection = useCallback(
    async <K extends Parameters<typeof client.putCollection>[0]>(key: K, value: Parameters<typeof client.putCollection<K>>[1]) => {
      if (hydratingRef.current || !loggedIn) return
      try {
        await client.putCollection(key, value)
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

  useEffect(() => {
    void syncCollection('agents', agentsState)
  }, [agentsState, syncCollection])
  useEffect(() => {
    void syncCollection('snapshots', snapshotsState)
  }, [snapshotsState, syncCollection])
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
      await loadFromApi()
      setIsLoading(false)
    },
    isLoading,
    error,
    clearError: () => setError(null),
    agents: agentsState,
    setAgents,
    snapshots: snapshotsState,
    setSnapshots,
    perfHistory: perfHistoryState,
    setPerfHistory,
    qaRecords: qaRecordsState,
    setQaRecords,
    auditRecords: auditRecordsState,
    setAuditRecords,
    attendance: attendanceState,
    setAttendance,
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
  }
}
