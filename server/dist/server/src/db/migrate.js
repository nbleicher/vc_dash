import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA_SQL } from './schema.js';
export function runMigrations(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.exec(SCHEMA_SQL);
    try {
        db.exec("ALTER TABLE audit_records ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
    }
    catch {
        // Column already exists (e.g. after schema bump)
    }
    db.close();
}
