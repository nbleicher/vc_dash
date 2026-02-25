import { Pool } from 'pg'
import type { StoreState } from '../types.js'
import type { EntityKey, StoreAdapter } from './store.types.js'

export class PostgresStore implements StoreAdapter {
  private readonly pool: Pool

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async getState(): Promise<StoreState> {
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
      lastPoliciesBotRun: await this.getLastPoliciesBotRun(),
    }
  }

  async getLastPoliciesBotRun(): Promise<string | null> {
    const result = await this.pool.query<{ payload: unknown }>(
      "SELECT payload FROM app_state WHERE key = 'lastPoliciesBotRun'",
    )
    if (result.rows.length === 0) return null
    const payload = result.rows[0].payload
    if (typeof payload === 'string') {
      const s = payload.trim()
      if (s.length === 0) return null
      if (s.startsWith('"')) {
        try {
          const parsed = JSON.parse(s) as unknown
          if (typeof parsed === 'string') return parsed.trim() || null
        } catch {
          // not valid JSON, use as-is
        }
      }
      return s
    }
    if (payload !== null && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      const value = obj.value ?? obj.timestamp
      if (typeof value === 'string') {
        const s = value.trim()
        return s.length > 0 ? s : null
      }
    }
    return null
  }

  async setLastPoliciesBotRun(iso: string): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO app_state (key, payload, updated_at)
      VALUES ('lastPoliciesBotRun', $1::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `,
      [JSON.stringify(iso)],
    )
  }

  async getCollection<T extends EntityKey>(key: T): Promise<StoreState[T]> {
    const result = await this.pool.query<{ payload: StoreState[T] }>('SELECT payload FROM app_state WHERE key = $1', [key])
    if (result.rows.length === 0) return [] as StoreState[T]
    return result.rows[0].payload
  }

  async replaceCollection<T extends EntityKey>(key: T, rows: StoreState[T]): Promise<StoreState[T]> {
    await this.pool.query(
      `
      INSERT INTO app_state (key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `,
      [key, JSON.stringify(rows)],
    )
    return rows
  }
}
