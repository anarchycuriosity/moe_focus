// ===== 数据库服务 — expo-sqlite 封装 =====
// 镜像桌面端的 DatabaseService，API 适配 React Native

import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  category      TEXT DEFAULT 'General',
  icon          TEXT DEFAULT 'star',
  color         TEXT DEFAULT '#FFB7C5',
  sort_order    INTEGER DEFAULT 0,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS todo_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  custom_title  TEXT,
  date          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  sort_order    INTEGER DEFAULT 0,
  completed_at  TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id             INTEGER REFERENCES todo_items(id) ON DELETE SET NULL,
  subject             TEXT,
  planned_duration_min INTEGER NOT NULL,
  actual_duration_sec INTEGER DEFAULT 0,
  rest_duration_sec   INTEGER DEFAULT 0,
  status              TEXT DEFAULT 'running',
  started_at          TEXT DEFAULT (datetime('now')),
  ended_at            TEXT,
  date                TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL UNIQUE,
  summary_text    TEXT,
  reflection_text TEXT,
  mood            TEXT,
  git_synced      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todo_date ON todo_items(date);
CREATE INDEX IF NOT EXISTS idx_focus_date ON focus_sessions(date);
`;

const DEFAULT_SETTINGS: Array<[string, string]> = [
  ['focus.defaultDuration', '25'],
  ['focus.defaultRestDuration', '5'],
  ['diary.autoGenerateTime', '23:00'],
  ['email.reminderEnabled', 'false'],
  ['github.remoteUrl', ''],
  ['github.branch', 'main']
];

async function get_db(): Promise<SQLite.SQLiteDatabase>
{
  if (!db)
  {
    db = await SQLite.openDatabaseAsync('moefocus.db')
    await db.execAsync(SCHEMA)

    // Apply default settings
    for (const [key, value] of DEFAULT_SETTINGS)
    {
      await db.runAsync(
        'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      )
    }
  }
  return db
}

export const DatabaseService = {
  async get_all(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]>
  {
    const d = await get_db()
    return d.getAllAsync(sql, ...params) as Promise<Record<string, unknown>[]>
  },

  async get_one(sql: string, params: unknown[] = []): Promise<Record<string, unknown> | null>
  {
    const d = await get_db()
    return d.getFirstAsync(sql, ...params) as Promise<Record<string, unknown> | null>
  },

  async run(sql: string, params: unknown[] = []): Promise<number>
  {
    const d = await get_db()
    const result = await d.runAsync(sql, ...params)
    return result.lastInsertRowId
  },

  async exec(sql: string): Promise<void>
  {
    const d = await get_db()
    await d.execAsync(sql)
  }
}
