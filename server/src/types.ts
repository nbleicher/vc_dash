export type Agent = {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export type Snapshot = {
  id: string
  dateKey: string
  slot: string
  slotLabel: string
  agentId: string
  billableCalls: number
  sales: number
  updatedAt: string
}

export type PerfHistory = {
  id: string
  dateKey: string
  agentId: string
  billableCalls: number
  sales: number
  marketing: number
  cpa: number | null
  cvr: number | null
  frozenAt: string
}

export type QaRecord = {
  id: string
  dateKey: string
  agentId: string
  clientName: string
  decision: 'Good Sale' | 'Check Recording'
  status: 'Good' | 'Check Recording' | 'Resolved'
  notes: string
  createdAt: string
  resolvedAt: string | null
}

export type AuditRecord = {
  id: string
  agentId: string
  carrier: string
  clientName: string
  reason: string
  currentStatus: string
  discoveryTs: string
  mgmtNotified: boolean
  outreachMade: boolean
  resolutionTs: string | null
  notes: string
}

export type AttendanceRecord = {
  id: string
  weekKey: string
  dateKey: string
  agentId: string
  percent: 100 | 75 | 50 | 25 | 0
  notes: string
}

export type SpiffRecord = {
  id: string
  weekKey: string
  dateKey: string
  agentId: string
  amount: number
}

export type AttendanceSubmission = {
  id: string
  dateKey: string
  submittedAt: string
  updatedAt: string
  submittedBy: string
  daySignature: string
}

export type IntraSubmission = {
  id: string
  dateKey: string
  slot: string
  submittedAt: string
  updatedAt: string
  submittedBy: string
  slotSignature: string
}

export type WeeklyTarget = {
  weekKey: string
  targetSales: number
  targetCpa: number
  setAt: string
}

export type VaultMeeting = {
  id: string
  agentId: string
  dateKey: string
  meetingType: 'Coaching' | 'Warning' | 'Review' | 'Transfer'
  notes: string
  actionItems: string
}

export type VaultDoc = {
  id: string
  agentId: string
  fileName: string
  fileSize: number
  uploadedAt: string
}

export type StoreState = {
  agents: Agent[]
  snapshots: Snapshot[]
  perfHistory: PerfHistory[]
  qaRecords: QaRecord[]
  auditRecords: AuditRecord[]
  attendance: AttendanceRecord[]
  spiffRecords: SpiffRecord[]
  attendanceSubmissions: AttendanceSubmission[]
  intraSubmissions: IntraSubmission[]
  weeklyTargets: WeeklyTarget[]
  vaultMeetings: VaultMeeting[]
  vaultDocs: VaultDoc[]
  /** Last time the policies bot successfully ran (ISO string). */
  lastPoliciesBotRun: string | null
}

export type ExportFlags = {
  agents: boolean
  performanceHistory: boolean
  qa: boolean
  audit: boolean
  attendance: boolean
}

export type ApiSuccess<T> = {
  data: T
  meta?: Record<string, unknown>
}

export type ApiFailure = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
