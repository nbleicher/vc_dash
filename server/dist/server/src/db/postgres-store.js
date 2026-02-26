import { Pool } from 'pg';
export class PostgresStore {
    pool;
    constructor(databaseUrl) {
        this.pool = new Pool({
            connectionString: databaseUrl,
            ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        });
    }
    async init() {
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    }
    async close() {
        await this.pool.end();
    }
    async getState() {
        return {
            agents: await this.getCollection('agents'),
            snapshots: await this.getCollection('snapshots'),
            perfHistory: await this.getCollection('perfHistory'),
            qaRecords: await this.getCollection('qaRecords'),
            auditRecords: await this.getCollection('auditRecords'),
            attendance: await this.getCollection('attendance'),
            spiffRecords: await this.getCollection('spiffRecords'),
            attendanceSubmissions: await this.getCollection('attendanceSubmissions'),
            intraSubmissions: await this.getCollection('intraSubmissions'),
            weeklyTargets: await this.getCollection('weeklyTargets'),
            vaultMeetings: await this.getCollection('vaultMeetings'),
            vaultDocs: await this.getCollection('vaultDocs'),
            eodReports: await this.getCollection('eodReports'),
            house6pmSnapshots: await this.getCollection('house6pmSnapshots'),
            lastPoliciesBotRun: await this.getLastPoliciesBotRun(),
            houseMarketing: await this.getHouseMarketing(),
        };
    }
    async getLastPoliciesBotRun() {
        const result = await this.pool.query("SELECT payload FROM app_state WHERE key = 'lastPoliciesBotRun'");
        if (result.rows.length === 0)
            return null;
        const payload = result.rows[0].payload;
        if (typeof payload === 'string') {
            const s = payload.trim();
            if (s.length === 0)
                return null;
            if (s.startsWith('"')) {
                try {
                    const parsed = JSON.parse(s);
                    if (typeof parsed === 'string')
                        return parsed.trim() || null;
                }
                catch {
                    // not valid JSON, use as-is
                }
            }
            return s;
        }
        if (payload !== null && typeof payload === 'object') {
            const obj = payload;
            const value = obj.value ?? obj.timestamp;
            if (typeof value === 'string') {
                const s = value.trim();
                return s.length > 0 ? s : null;
            }
        }
        return null;
    }
    async setLastPoliciesBotRun(iso) {
        await this.pool.query(`
      INSERT INTO app_state (key, payload, updated_at)
      VALUES ('lastPoliciesBotRun', $1::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `, [JSON.stringify(iso)]);
    }
    async getHouseMarketing() {
        const result = await this.pool.query("SELECT payload FROM app_state WHERE key = 'houseMarketing'");
        if (result.rows.length === 0)
            return null;
        const payload = result.rows[0].payload;
        if (payload !== null && typeof payload === 'object') {
            const obj = payload;
            const dateKey = typeof obj.dateKey === 'string' ? obj.dateKey : null;
            const amount = typeof obj.amount === 'number' ? obj.amount : Number(obj.amount);
            if (dateKey && Number.isFinite(amount))
                return { dateKey, amount };
        }
        return null;
    }
    async setHouseMarketing(dateKey, amount) {
        await this.pool.query(`
      INSERT INTO app_state (key, payload, updated_at)
      VALUES ('houseMarketing', $1::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `, [JSON.stringify({ dateKey, amount })]);
    }
    async getCollection(key) {
        const result = await this.pool.query('SELECT payload FROM app_state WHERE key = $1', [key]);
        if (result.rows.length === 0)
            return [];
        return result.rows[0].payload;
    }
    async replaceCollection(key, rows) {
        await this.pool.query(`
      INSERT INTO app_state (key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `, [key, JSON.stringify(rows)]);
        return rows;
    }
}
