import { runMigrations } from './migrate.js'
import { SqliteStore } from './store.js'
import type { StoreState } from '../types.js'

const DB_PATH = process.env.DB_PATH ?? './server/data/vc_dash.sqlite'

const seedState: StoreState = {
  agents: [
    { id: 'agent_1', name: 'Alex', active: true, createdAt: new Date().toISOString() },
    { id: 'agent_2', name: 'Jordan', active: true, createdAt: new Date().toISOString() },
  ],
  snapshots: [],
  perfHistory: [],
  qaRecords: [],
  auditRecords: [],
  attendance: [],
  spiffRecords: [],
  attendanceSubmissions: [],
  intraSubmissions: [],
  weeklyTargets: [],
  vaultMeetings: [],
  vaultDocs: [],
}

runMigrations(DB_PATH)
const store = new SqliteStore(DB_PATH)
await store.replaceCollection('agents', seedState.agents)
store.close()

console.log(`Seed complete for ${DB_PATH}`)
