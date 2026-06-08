import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

const schema = `
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
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id              INTEGER REFERENCES todo_items(id) ON DELETE SET NULL,
  subject              TEXT,
  planned_duration_min INTEGER NOT NULL,
  actual_duration_sec  INTEGER DEFAULT 0,
  rest_duration_sec    INTEGER DEFAULT 0,
  status               TEXT DEFAULT 'running',
  uuid                 TEXT UNIQUE,
  started_at           TEXT DEFAULT (datetime('now')),
  ended_at             TEXT,
  date                 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL UNIQUE,
  file_path       TEXT,
  summary_text    TEXT,
  reflection_text TEXT,
  mood            TEXT,
  git_committed   INTEGER DEFAULT 0,
  git_pushed      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS long_term_goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  deadline    TEXT,
  status      TEXT DEFAULT 'active',
  sort_order  INTEGER DEFAULT 0,
  is_deleted  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todo_date ON todo_items(date);
CREATE INDEX IF NOT EXISTS idx_focus_date ON focus_sessions(date);
CREATE INDEX IF NOT EXISTS idx_focus_uuid ON focus_sessions(uuid);
CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(date);
CREATE INDEX IF NOT EXISTS idx_long_term_goals_uuid ON long_term_goals(uuid);
`

const default_settings: Array<[string, string]> = [
  ['focus.defaultDuration', '25'],
  ['focus.defaultRestDuration', '5'],
  ['focus.dailyGoal', '120'],
  ['diary.autoGenerateTime', '23:00'],
  ['github.remoteUrl', ''],
  ['github.owner', ''],
  ['github.repo', ''],
  ['github.branch', 'main'],
  ['github.token', ''],
  ['ui.theme', 'sakura'],
  ['ui.darkMode', 'false']
]

async function migrate(db_handle: SQLite.SQLiteDatabase): Promise<void>
{
  const columns = await db_handle.getAllAsync<{ name: string }>('PRAGMA table_info(focus_sessions)')
  if (!columns.some((column) => column.name === 'uuid'))
  {
    await db_handle.execAsync('ALTER TABLE focus_sessions ADD COLUMN uuid TEXT')
    await db_handle.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_uuid ON focus_sessions(uuid)')
  }
}

async function get_db(): Promise<SQLite.SQLiteDatabase>
{
  if (!db)
  {
    db = await SQLite.openDatabaseAsync('moefocus.db')
    await db.execAsync(schema)
    await migrate(db)

    for (const [key, value] of default_settings)
    {
      await db.runAsync(
        'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        key,
        value
      )
    }
  }

  return db
}

export const DatabaseService = {
  async get_all<T = Record<string, unknown>>(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<T[]>
  {
    const db_handle = await get_db()
    return db_handle.getAllAsync<T>(sql, ...params)
  },

  async get_one<T = Record<string, unknown>>(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<T | null>
  {
    const db_handle = await get_db()
    return db_handle.getFirstAsync<T>(sql, ...params)
  },

  async run(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<number>
  {
    const db_handle = await get_db()
    const result = await db_handle.runAsync(sql, ...params)
    return result.lastInsertRowId
  },

  async exec(sql: string): Promise<void>
  {
    const db_handle = await get_db()
    await db_handle.execAsync(sql)
  },

  async get_settings(): Promise<Record<string, string>>
  {
    const rows = await this.get_all<{ key: string; value: string }>('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    for (const row of rows)
    {
      settings[row.key] = row.value
    }
    return settings
  },

  async set_setting(key: string, value: string): Promise<void>
  {
    await this.run(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      [key, value, value]
    )
  }
}
