import { runMigrations } from './migrate.js';
import { PostgresStore } from './postgres-store.js';
import { SqliteStore } from './store.js';
const SQLITE_PATH = process.env.DB_PATH ?? './server/data/vc_dash.sqlite';
const databaseUrl = process.env.DATABASE_URL;
const keys = [
    'agents',
    'snapshots',
    'perfHistory',
    'qaRecords',
    'auditRecords',
    'attendance',
    'attendanceSubmissions',
    'intraSubmissions',
    'weeklyTargets',
    'vaultMeetings',
    'vaultDocs',
];
async function run() {
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required to import SQLite data into Postgres.');
    }
    runMigrations(SQLITE_PATH);
    const sqlite = new SqliteStore(SQLITE_PATH);
    const postgres = new PostgresStore(databaseUrl);
    await postgres.init();
    for (const key of keys) {
        const rows = await sqlite.getCollection(key);
        await postgres.replaceCollection(key, rows);
        console.log(`Imported ${key}: ${rows.length} rows`);
    }
    sqlite.close();
    await postgres.close();
}
await run();
