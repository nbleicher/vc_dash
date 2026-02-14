import type { Dispatch, SetStateAction } from 'react'
import type {
  Agent,
  AttendanceRecord,
  AuditRecord,
  PerfHistory,
  QaRecord,
  Snapshot,
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
  isLoading: boolean
  error: string | null
  clearError: () => void

  agents: Agent[]
  setAgents: Dispatch<SetStateAction<Agent[]>>

  snapshots: Snapshot[]
  setSnapshots: Dispatch<SetStateAction<Snapshot[]>>

  perfHistory: PerfHistory[]
  setPerfHistory: Dispatch<SetStateAction<PerfHistory[]>>

  qaRecords: QaRecord[]
  setQaRecords: Dispatch<SetStateAction<QaRecord[]>>

  auditRecords: AuditRecord[]
  setAuditRecords: Dispatch<SetStateAction<AuditRecord[]>>

  attendance: AttendanceRecord[]
  setAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>

  weeklyTargets: WeeklyTarget[]
  setWeeklyTargets: Dispatch<SetStateAction<WeeklyTarget[]>>

  vaultMeetings: VaultMeeting[]
  setVaultMeetings: Dispatch<SetStateAction<VaultMeeting[]>>

  vaultDocs: VaultDoc[]
  setVaultDocs: Dispatch<SetStateAction<VaultDoc[]>>
}
