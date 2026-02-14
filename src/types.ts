export type TopPage = 'dashboard' | 'tasks' | 'metrics' | 'vault' | 'settings'
export type TaskPage = 'attendance' | 'qa' | 'audit' | 'targets'
export type VaultHistoryView = 'attendance' | 'qa' | 'audit' | 'targets'
export type VaultScope = 'agent' | 'house'
export type MetricsScope = 'house' | 'agent'
export type HistorySort = 'newest' | 'oldest'
export type QaStatus = 'Good' | 'Check Recording' | 'Resolved'
export type AttendancePercent = 100 | 75 | 50 | 25 | 0
export type RankMetric = 'CPA' | 'CVR' | 'Sales'
export type RankPeriod = 'day' | 'week' | 'month'

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
  status: QaStatus
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
}

export type AttendanceRecord = {
  id: string
  weekKey: string
  dateKey: string
  agentId: string
  percent: AttendancePercent
  notes: string
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
  meetingType: 'Coaching' | 'Warning' | 'Review'
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

export type ExportFlags = {
  agents: boolean
  performanceHistory: boolean
  qa: boolean
  audit: boolean
  attendance: boolean
}
