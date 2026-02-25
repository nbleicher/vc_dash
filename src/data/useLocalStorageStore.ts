import { useEffect, useState } from 'react'
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

function useStoredState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key)
    if (!raw) return initial
    try {
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

export function useDataStore(): DataStore {
  const [loggedIn, setLoggedIn] = useStoredState<boolean>('vc_logged_in', false)
  const [agents, setAgents] = useStoredState<Agent[]>('vc_agents', [])
  const [snapshots, setSnapshots] = useStoredState<Snapshot[]>('vc_snapshots', [])
  const [perfHistory, setPerfHistory] = useStoredState<PerfHistory[]>('vc_perf_history', [])
  const [qaRecords, setQaRecords] = useStoredState<QaRecord[]>('vc_qa_records', [])
  const [auditRecords, setAuditRecords] = useStoredState<AuditRecord[]>('vc_audit_records', [])
  const [attendance, setAttendance] = useStoredState<AttendanceRecord[]>('vc_attendance', [])
  const [spiffRecords, setSpiffRecords] = useStoredState<SpiffRecord[]>('vc_spiff_records', [])
  const [attendanceSubmissions, setAttendanceSubmissions] = useStoredState<AttendanceSubmission[]>(
    'vc_attendance_submissions',
    [],
  )
  const [intraSubmissions, setIntraSubmissions] = useStoredState<IntraSubmission[]>('vc_intra_submissions', [])
  const [weeklyTargets, setWeeklyTargets] = useStoredState<WeeklyTarget[]>('vc_weekly_targets', [])
  const [vaultMeetings, setVaultMeetings] = useStoredState<VaultMeeting[]>('vc_vault_meetings', [])
  const [vaultDocs, setVaultDocs] = useStoredState<VaultDoc[]>('vc_vault_docs', [])

  return {
    loggedIn,
    setLoggedIn,
    login: async (username: string, password: string) => {
      if (username === 'admin' && password === 'admin') {
        setLoggedIn(true)
        return
      }
      throw new Error('Invalid credentials.')
    },
    logout: async () => setLoggedIn(false),
    reload: async () => undefined,
    lastFetchedAt: null,
    isLoading: false,
    error: null,
    clearError: () => undefined,
    agents,
    setAgents,
    snapshots,
    setSnapshots,
    pushSnapshotsToApi: async () => undefined,
    perfHistory,
    setPerfHistory,
    qaRecords,
    setQaRecords,
    auditRecords,
    setAuditRecords,
    lastPoliciesBotRun: null,
    houseMarketing: null,
    attendance,
    setAttendance,
    spiffRecords,
    setSpiffRecords,
    attendanceSubmissions,
    setAttendanceSubmissions,
    intraSubmissions,
    setIntraSubmissions,
    weeklyTargets,
    setWeeklyTargets,
    vaultMeetings,
    setVaultMeetings,
    vaultDocs,
    setVaultDocs,
  }
}
