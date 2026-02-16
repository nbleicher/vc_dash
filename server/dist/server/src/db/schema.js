export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  dateKey TEXT NOT NULL,
  slot TEXT NOT NULL,
  slotLabel TEXT NOT NULL,
  agentId TEXT NOT NULL,
  billableCalls INTEGER NOT NULL,
  sales INTEGER NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS perf_history (
  id TEXT PRIMARY KEY,
  dateKey TEXT NOT NULL,
  agentId TEXT NOT NULL,
  billableCalls INTEGER NOT NULL,
  sales INTEGER NOT NULL,
  marketing REAL NOT NULL,
  cpa REAL,
  cvr REAL,
  frozenAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_records (
  id TEXT PRIMARY KEY,
  dateKey TEXT NOT NULL,
  agentId TEXT NOT NULL,
  clientName TEXT NOT NULL,
  decision TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT
);

CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  carrier TEXT NOT NULL,
  clientName TEXT NOT NULL,
  reason TEXT NOT NULL,
  currentStatus TEXT NOT NULL,
  discoveryTs TEXT NOT NULL,
  mgmtNotified INTEGER NOT NULL CHECK(mgmtNotified IN (0,1)),
  outreachMade INTEGER NOT NULL CHECK(outreachMade IN (0,1)),
  resolutionTs TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  weekKey TEXT NOT NULL,
  dateKey TEXT NOT NULL,
  agentId TEXT NOT NULL,
  percent INTEGER NOT NULL,
  notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_submissions (
  id TEXT PRIMARY KEY,
  dateKey TEXT NOT NULL,
  submittedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  submittedBy TEXT NOT NULL,
  daySignature TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intra_submissions (
  id TEXT PRIMARY KEY,
  dateKey TEXT NOT NULL,
  slot TEXT NOT NULL,
  submittedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  submittedBy TEXT NOT NULL,
  slotSignature TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_targets (
  weekKey TEXT PRIMARY KEY,
  targetSales INTEGER NOT NULL,
  targetCpa REAL NOT NULL,
  setAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_meetings (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  dateKey TEXT NOT NULL,
  meetingType TEXT NOT NULL,
  notes TEXT NOT NULL,
  actionItems TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_docs (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  fileName TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  uploadedAt TEXT NOT NULL
);
`;
