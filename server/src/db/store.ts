import Database from 'better-sqlite3'
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
  StoreState,
  VaultDoc,
  VaultMeeting,
  WeeklyTarget,
} from '../types.js'
import type { EntityKey, StoreAdapter } from './store.types.js'

export class SqliteStore implements StoreAdapter {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
  }

  close(): void {
    this.db.close()
  }

  async getState(): Promise<StoreState> {
    return {
      agents: this.getAgents(),
      snapshots: this.getSnapshots(),
      perfHistory: this.getPerfHistory(),
      qaRecords: this.getQaRecords(),
      auditRecords: this.getAuditRecords(),
      attendance: this.getAttendance(),
      spiffRecords: this.getSpiffRecords(),
      attendanceSubmissions: this.getAttendanceSubmissions(),
      intraSubmissions: this.getIntraSubmissions(),
      weeklyTargets: this.getWeeklyTargets(),
      vaultMeetings: this.getVaultMeetings(),
      vaultDocs: this.getVaultDocs(),
      lastPoliciesBotRun: this.getLastPoliciesBotRun(),
    }
  }

  async getCollection<T extends EntityKey>(key: T): Promise<StoreState[T]> {
    const state = await this.getState()
    return state[key]
  }

  async replaceCollection<T extends EntityKey>(key: T, rows: StoreState[T]): Promise<StoreState[T]> {
    const tx = this.db.transaction(() => {
      switch (key) {
        case 'agents':
          this.db.prepare('DELETE FROM agents').run()
          for (const row of rows as Agent[]) {
            this.db
              .prepare('INSERT INTO agents (id,name,active,createdAt) VALUES (@id,@name,@active,@createdAt)')
              .run({ ...row, active: row.active ? 1 : 0 })
          }
          break
        case 'snapshots':
          this.db.prepare('DELETE FROM snapshots').run()
          for (const row of rows as Snapshot[]) {
            this.db
              .prepare(
                'INSERT INTO snapshots (id,dateKey,slot,slotLabel,agentId,billableCalls,sales,updatedAt) VALUES (@id,@dateKey,@slot,@slotLabel,@agentId,@billableCalls,@sales,@updatedAt)',
              )
              .run(row)
          }
          break
        case 'perfHistory':
          this.db.prepare('DELETE FROM perf_history').run()
          for (const row of rows as PerfHistory[]) {
            this.db
              .prepare(
                'INSERT INTO perf_history (id,dateKey,agentId,billableCalls,sales,marketing,cpa,cvr,frozenAt) VALUES (@id,@dateKey,@agentId,@billableCalls,@sales,@marketing,@cpa,@cvr,@frozenAt)',
              )
              .run(row)
          }
          break
        case 'qaRecords':
          this.db.prepare('DELETE FROM qa_records').run()
          for (const row of rows as QaRecord[]) {
            this.db
              .prepare(
                'INSERT INTO qa_records (id,dateKey,agentId,clientName,decision,status,notes,createdAt,resolvedAt) VALUES (@id,@dateKey,@agentId,@clientName,@decision,@status,@notes,@createdAt,@resolvedAt)',
              )
              .run(row)
          }
          break
        case 'auditRecords':
          this.db.prepare('DELETE FROM audit_records').run()
          for (const row of rows as AuditRecord[]) {
            this.db
              .prepare(
                'INSERT INTO audit_records (id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs,notes) VALUES (@id,@agentId,@carrier,@clientName,@reason,@currentStatus,@discoveryTs,@mgmtNotified,@outreachMade,@resolutionTs,@notes)',
              )
              .run({
                ...row,
                mgmtNotified: row.mgmtNotified ? 1 : 0,
                outreachMade: row.outreachMade ? 1 : 0,
                notes: row.notes ?? '',
              })
          }
          break
        case 'attendance':
          this.db.prepare('DELETE FROM attendance').run()
          for (const row of rows as AttendanceRecord[]) {
            this.db
              .prepare(
                'INSERT INTO attendance (id,weekKey,dateKey,agentId,percent,notes) VALUES (@id,@weekKey,@dateKey,@agentId,@percent,@notes)',
              )
              .run(row)
          }
          break
        case 'spiffRecords':
          this.db.prepare('DELETE FROM spiff_records').run()
          for (const row of rows as SpiffRecord[]) {
            this.db
              .prepare(
                'INSERT INTO spiff_records (id,weekKey,dateKey,agentId,amount) VALUES (@id,@weekKey,@dateKey,@agentId,@amount)',
              )
              .run(row)
          }
          break
        case 'attendanceSubmissions':
          this.db.prepare('DELETE FROM attendance_submissions').run()
          for (const row of rows as AttendanceSubmission[]) {
            this.db
              .prepare(
                'INSERT INTO attendance_submissions (id,dateKey,submittedAt,updatedAt,submittedBy,daySignature) VALUES (@id,@dateKey,@submittedAt,@updatedAt,@submittedBy,@daySignature)',
              )
              .run(row)
          }
          break
        case 'intraSubmissions':
          this.db.prepare('DELETE FROM intra_submissions').run()
          for (const row of rows as IntraSubmission[]) {
            this.db
              .prepare(
                'INSERT INTO intra_submissions (id,dateKey,slot,submittedAt,updatedAt,submittedBy,slotSignature) VALUES (@id,@dateKey,@slot,@submittedAt,@updatedAt,@submittedBy,@slotSignature)',
              )
              .run(row)
          }
          break
        case 'weeklyTargets':
          this.db.prepare('DELETE FROM weekly_targets').run()
          for (const row of rows as WeeklyTarget[]) {
            this.db
              .prepare(
                'INSERT INTO weekly_targets (weekKey,targetSales,targetCpa,setAt) VALUES (@weekKey,@targetSales,@targetCpa,@setAt)',
              )
              .run(row)
          }
          break
        case 'vaultMeetings':
          this.db.prepare('DELETE FROM vault_meetings').run()
          for (const row of rows as VaultMeeting[]) {
            this.db
              .prepare(
                'INSERT INTO vault_meetings (id,agentId,dateKey,meetingType,notes,actionItems) VALUES (@id,@agentId,@dateKey,@meetingType,@notes,@actionItems)',
              )
              .run(row)
          }
          break
        case 'vaultDocs':
          this.db.prepare('DELETE FROM vault_docs').run()
          for (const row of rows as VaultDoc[]) {
            this.db
              .prepare(
                'INSERT INTO vault_docs (id,agentId,fileName,fileSize,uploadedAt) VALUES (@id,@agentId,@fileName,@fileSize,@uploadedAt)',
              )
              .run(row)
          }
          break
      }
    })

    tx()
    return rows
  }

  private getAgents(): Agent[] {
    const rows = this.db.prepare('SELECT id,name,active,createdAt FROM agents ORDER BY createdAt ASC').all() as Array<{
      id: string
      name: string
      active: number
      createdAt: string
    }>
    return rows.map((x) => ({ ...x, active: Boolean(x.active) }))
  }

  private getSnapshots(): Snapshot[] {
    return this.db
      .prepare('SELECT id,dateKey,slot,slotLabel,agentId,billableCalls,sales,updatedAt FROM snapshots')
      .all() as Snapshot[]
  }

  private getPerfHistory(): PerfHistory[] {
    return this.db
      .prepare('SELECT id,dateKey,agentId,billableCalls,sales,marketing,cpa,cvr,frozenAt FROM perf_history')
      .all() as PerfHistory[]
  }

  private getQaRecords(): QaRecord[] {
    return this.db
      .prepare('SELECT id,dateKey,agentId,clientName,decision,status,notes,createdAt,resolvedAt FROM qa_records')
      .all() as QaRecord[]
  }

  private getAuditRecords(): AuditRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs,notes FROM audit_records',
      )
      .all() as Array<{
        id: string
        agentId: string
        carrier: string
        clientName: string
        reason: string
        currentStatus: string
        discoveryTs: string
        mgmtNotified: number
        outreachMade: number
        resolutionTs: string | null
        notes?: string
      }>

    return rows.map((x) => ({
      ...x,
      mgmtNotified: Boolean(x.mgmtNotified),
      outreachMade: Boolean(x.outreachMade),
      notes: x.notes ?? '',
    }))
  }

  private getAttendance(): AttendanceRecord[] {
    return this.db
      .prepare('SELECT id,weekKey,dateKey,agentId,percent,notes FROM attendance')
      .all() as AttendanceRecord[]
  }

  private getAttendanceSubmissions(): AttendanceSubmission[] {
    return this.db
      .prepare('SELECT id,dateKey,submittedAt,updatedAt,submittedBy,daySignature FROM attendance_submissions')
      .all() as AttendanceSubmission[]
  }

  private getSpiffRecords(): SpiffRecord[] {
    return this.db
      .prepare('SELECT id,weekKey,dateKey,agentId,amount FROM spiff_records')
      .all() as SpiffRecord[]
  }

  private getIntraSubmissions(): IntraSubmission[] {
    return this.db
      .prepare('SELECT id,dateKey,slot,submittedAt,updatedAt,submittedBy,slotSignature FROM intra_submissions')
      .all() as IntraSubmission[]
  }

  private getWeeklyTargets(): WeeklyTarget[] {
    return this.db
      .prepare('SELECT weekKey,targetSales,targetCpa,setAt FROM weekly_targets')
      .all() as WeeklyTarget[]
  }

  private getVaultMeetings(): VaultMeeting[] {
    return this.db
      .prepare('SELECT id,agentId,dateKey,meetingType,notes,actionItems FROM vault_meetings')
      .all() as VaultMeeting[]
  }

  private getVaultDocs(): VaultDoc[] {
    return this.db
      .prepare('SELECT id,agentId,fileName,fileSize,uploadedAt FROM vault_docs')
      .all() as VaultDoc[]
  }

  private getLastPoliciesBotRun(): string | null {
    const row = this.db.prepare("SELECT value FROM app_meta WHERE key = 'lastPoliciesBotRun'").get() as { value: string } | undefined
    return row?.value ?? null
  }

  async setLastPoliciesBotRun(iso: string): Promise<void> {
    this.db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('lastPoliciesBotRun', ?)").run(iso)
  }
}
