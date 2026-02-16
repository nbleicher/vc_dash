import Database from 'better-sqlite3';
export class SqliteStore {
    db;
    constructor(dbPath) {
        this.db = new Database(dbPath);
    }
    close() {
        this.db.close();
    }
    async getState() {
        return {
            agents: this.getAgents(),
            snapshots: this.getSnapshots(),
            perfHistory: this.getPerfHistory(),
            qaRecords: this.getQaRecords(),
            auditRecords: this.getAuditRecords(),
            attendance: this.getAttendance(),
            attendanceSubmissions: this.getAttendanceSubmissions(),
            intraSubmissions: this.getIntraSubmissions(),
            weeklyTargets: this.getWeeklyTargets(),
            vaultMeetings: this.getVaultMeetings(),
            vaultDocs: this.getVaultDocs(),
        };
    }
    async getCollection(key) {
        const state = await this.getState();
        return state[key];
    }
    async replaceCollection(key, rows) {
        const tx = this.db.transaction(() => {
            switch (key) {
                case 'agents':
                    this.db.prepare('DELETE FROM agents').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO agents (id,name,active,createdAt) VALUES (@id,@name,@active,@createdAt)')
                            .run({ ...row, active: row.active ? 1 : 0 });
                    }
                    break;
                case 'snapshots':
                    this.db.prepare('DELETE FROM snapshots').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO snapshots (id,dateKey,slot,slotLabel,agentId,billableCalls,sales,updatedAt) VALUES (@id,@dateKey,@slot,@slotLabel,@agentId,@billableCalls,@sales,@updatedAt)')
                            .run(row);
                    }
                    break;
                case 'perfHistory':
                    this.db.prepare('DELETE FROM perf_history').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO perf_history (id,dateKey,agentId,billableCalls,sales,marketing,cpa,cvr,frozenAt) VALUES (@id,@dateKey,@agentId,@billableCalls,@sales,@marketing,@cpa,@cvr,@frozenAt)')
                            .run(row);
                    }
                    break;
                case 'qaRecords':
                    this.db.prepare('DELETE FROM qa_records').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO qa_records (id,dateKey,agentId,clientName,decision,status,notes,createdAt,resolvedAt) VALUES (@id,@dateKey,@agentId,@clientName,@decision,@status,@notes,@createdAt,@resolvedAt)')
                            .run(row);
                    }
                    break;
                case 'auditRecords':
                    this.db.prepare('DELETE FROM audit_records').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO audit_records (id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs) VALUES (@id,@agentId,@carrier,@clientName,@reason,@currentStatus,@discoveryTs,@mgmtNotified,@outreachMade,@resolutionTs)')
                            .run({ ...row, mgmtNotified: row.mgmtNotified ? 1 : 0, outreachMade: row.outreachMade ? 1 : 0 });
                    }
                    break;
                case 'attendance':
                    this.db.prepare('DELETE FROM attendance').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO attendance (id,weekKey,dateKey,agentId,percent,notes) VALUES (@id,@weekKey,@dateKey,@agentId,@percent,@notes)')
                            .run(row);
                    }
                    break;
                case 'attendanceSubmissions':
                    this.db.prepare('DELETE FROM attendance_submissions').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO attendance_submissions (id,dateKey,submittedAt,updatedAt,submittedBy,daySignature) VALUES (@id,@dateKey,@submittedAt,@updatedAt,@submittedBy,@daySignature)')
                            .run(row);
                    }
                    break;
                case 'intraSubmissions':
                    this.db.prepare('DELETE FROM intra_submissions').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO intra_submissions (id,dateKey,slot,submittedAt,updatedAt,submittedBy,slotSignature) VALUES (@id,@dateKey,@slot,@submittedAt,@updatedAt,@submittedBy,@slotSignature)')
                            .run(row);
                    }
                    break;
                case 'weeklyTargets':
                    this.db.prepare('DELETE FROM weekly_targets').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO weekly_targets (weekKey,targetSales,targetCpa,setAt) VALUES (@weekKey,@targetSales,@targetCpa,@setAt)')
                            .run(row);
                    }
                    break;
                case 'vaultMeetings':
                    this.db.prepare('DELETE FROM vault_meetings').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO vault_meetings (id,agentId,dateKey,meetingType,notes,actionItems) VALUES (@id,@agentId,@dateKey,@meetingType,@notes,@actionItems)')
                            .run(row);
                    }
                    break;
                case 'vaultDocs':
                    this.db.prepare('DELETE FROM vault_docs').run();
                    for (const row of rows) {
                        this.db
                            .prepare('INSERT INTO vault_docs (id,agentId,fileName,fileSize,uploadedAt) VALUES (@id,@agentId,@fileName,@fileSize,@uploadedAt)')
                            .run(row);
                    }
                    break;
            }
        });
        tx();
        return rows;
    }
    getAgents() {
        const rows = this.db.prepare('SELECT id,name,active,createdAt FROM agents ORDER BY createdAt ASC').all();
        return rows.map((x) => ({ ...x, active: Boolean(x.active) }));
    }
    getSnapshots() {
        return this.db
            .prepare('SELECT id,dateKey,slot,slotLabel,agentId,billableCalls,sales,updatedAt FROM snapshots')
            .all();
    }
    getPerfHistory() {
        return this.db
            .prepare('SELECT id,dateKey,agentId,billableCalls,sales,marketing,cpa,cvr,frozenAt FROM perf_history')
            .all();
    }
    getQaRecords() {
        return this.db
            .prepare('SELECT id,dateKey,agentId,clientName,decision,status,notes,createdAt,resolvedAt FROM qa_records')
            .all();
    }
    getAuditRecords() {
        const rows = this.db
            .prepare('SELECT id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs FROM audit_records')
            .all();
        return rows.map((x) => ({ ...x, mgmtNotified: Boolean(x.mgmtNotified), outreachMade: Boolean(x.outreachMade) }));
    }
    getAttendance() {
        return this.db
            .prepare('SELECT id,weekKey,dateKey,agentId,percent,notes FROM attendance')
            .all();
    }
    getAttendanceSubmissions() {
        return this.db
            .prepare('SELECT id,dateKey,submittedAt,updatedAt,submittedBy,daySignature FROM attendance_submissions')
            .all();
    }
    getIntraSubmissions() {
        return this.db
            .prepare('SELECT id,dateKey,slot,submittedAt,updatedAt,submittedBy,slotSignature FROM intra_submissions')
            .all();
    }
    getWeeklyTargets() {
        return this.db
            .prepare('SELECT weekKey,targetSales,targetCpa,setAt FROM weekly_targets')
            .all();
    }
    getVaultMeetings() {
        return this.db
            .prepare('SELECT id,agentId,dateKey,meetingType,notes,actionItems FROM vault_meetings')
            .all();
    }
    getVaultDocs() {
        return this.db
            .prepare('SELECT id,agentId,fileName,fileSize,uploadedAt FROM vault_docs')
            .all();
    }
}
