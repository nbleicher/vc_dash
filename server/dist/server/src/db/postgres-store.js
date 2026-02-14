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
            weeklyTargets: await this.getCollection('weeklyTargets'),
            vaultMeetings: await this.getCollection('vaultMeetings'),
            vaultDocs: await this.getCollection('vaultDocs'),
        };
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
