import type { Dispatch, SetStateAction } from 'react'
import type {
  Agent,
  AttendanceRecord,
  AttendanceSubmission,
  AuditRecord,
  EodReport,
  House6pmSnapshot,
  IntraSubmission,
  PerfHistory,
  QaRecord,
  Snapshot,
  SpiffRecord,
  VaultDoc,
  VaultMeeting,
  WeeklyTarget,
} from '../types'

export interface DataStore {
  loggedIn: boolean
  setLoggedIn: Dispatch<SetStateAction<boolean>>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  reload: () => Promise<void>
  /** When we last successfully fetched state from the API (ISO string or null). */
  lastFetchedAt: string | null
  isLoading: boolean
  error: string | null
  clearError: () => void

  agents: Agent[]
  setAgents: Dispatch<SetStateAction<Agent[]>>

  snapshots: Snapshot[]
  setSnapshots: Dispatch<SetStateAction<Snapshot[]>>
  /** Push snapshots to API (e.g. when user clears history). Normal sync is disabled so the bot is the only writer. */
  pushSnapshotsToApi: (snapshots: Snapshot[]) => Promise<void>

  perfHistory: PerfHistory[]
  setPerfHistory: Dispatch<SetStateAction<PerfHistory[]>>

  qaRecords: QaRecord[]
  setQaRecords: Dispatch<SetStateAction<QaRecord[]>>

  auditRecords: AuditRecord[]
  setAuditRecords: Dispatch<SetStateAction<AuditRecord[]>>

  /** Last time the policies bot ran (ISO string), for "Last parsed" column. */
  lastPoliciesBotRun: string | null

  /** Scraped campaign marketing for house pulse (set by bot). */
  houseMarketing: { dateKey: string; amount: number } | null

  attendance: AttendanceRecord[]
  setAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>

  spiffRecords: SpiffRecord[]
  setSpiffRecords: Dispatch<SetStateAction<SpiffRecord[]>>

  attendanceSubmissions: AttendanceSubmission[]
  setAttendanceSubmissions: Dispatch<SetStateAction<AttendanceSubmission[]>>

  intraSubmissions: IntraSubmission[]
  setIntraSubmissions: Dispatch<SetStateAction<IntraSubmission[]>>

  weeklyTargets: WeeklyTarget[]
  setWeeklyTargets: Dispatch<SetStateAction<WeeklyTarget[]>>

  vaultMeetings: VaultMeeting[]
  setVaultMeetings: Dispatch<SetStateAction<VaultMeeting[]>>

  vaultDocs: VaultDoc[]
  setVaultDocs: Dispatch<SetStateAction<VaultDoc[]>>

  eodReports: EodReport[]
  setEodReports: Dispatch<SetStateAction<EodReport[]>>

  house6pmSnapshots: House6pmSnapshot[]
  setHouse6pmSnapshots: Dispatch<SetStateAction<House6pmSnapshot[]>>
}
