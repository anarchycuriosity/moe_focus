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
  ['ui.darkMode', 'false'],
  ['ui.wallpaper.default', ''],
  ['ui.wallpaper.today', ''],
  ['ui.wallpaper.focus', ''],
  ['ui.wallpaper.statistics', ''],
  ['ui.wallpaper.goals', ''],
  ['ui.wallpaper.diary', ''],
  ['ui.wallpaper.settings', ''],
  ['ui.photoFrame.url', '']
]

type Sqlite_value = SQLite.SQLStatementArg

function split_sql_script(sql: string): string[]
{
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

function is_insert_sql(sql: string): boolean
{
  return sql.trim().toUpperCase().startsWith('INSERT')
}

async function execute_sql(sql: string, params: Sqlite_value[] = []): Promise<SQLite.ResultSet>
{
  const db_handle = await get_db()

  let result: SQLite.ResultSet | null = null
  await db_handle.transactionAsync(async (transaction) =>
  {
    result = await transaction.executeSqlAsync(sql, params)
  })

  if (!result)
  {
    throw new Error(`SQL 执行没有返回结果: ${sql}`)
  }

  return result
}

async function migrate(db_handle: SQLite.SQLiteDatabase): Promise<void>
{
  let columns: Array<{ name: string }> = []
  await db_handle.transactionAsync(async (transaction) =>
  {
    const result = await transaction.executeSqlAsync('PRAGMA table_info(focus_sessions)')
    columns = result.rows as Array<{ name: string }>
  })

  if (!columns.some((column) => column.name === 'uuid'))
  {
    await db_handle.execAsync([
      { sql: 'ALTER TABLE focus_sessions ADD COLUMN uuid TEXT', args: [] },
      { sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_uuid ON focus_sessions(uuid)', args: [] }
    ], false)
  }
}

async function get_db(): Promise<SQLite.SQLiteDatabase>
{
  if (!db)
  {
    db = SQLite.openDatabase('moefocus.db')
    await db.execAsync(split_sql_script(schema).map((statement) => ({ sql: statement, args: [] })), false)
    await migrate(db)

    for (const [key, value] of default_settings)
    {
      await execute_sql(
        'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      )
    }
  }

  return db
}

export const DatabaseService = {
  async get_all<T = Record<string, unknown>>(sql: string, params: Sqlite_value[] = []): Promise<T[]>
  {
    const result = await execute_sql(sql, params)
    return result.rows as T[]
  },

  async get_one<T = Record<string, unknown>>(sql: string, params: Sqlite_value[] = []): Promise<T | null>
  {
    const rows = await this.get_all<T>(sql, params)
    return rows[0] ?? null
  },

  async run(sql: string, params: Sqlite_value[] = []): Promise<number>
  {
    const result = await execute_sql(sql, params)
    if (typeof result.insertId === 'number' && result.insertId > 0)
    {
      return result.insertId
    }

    if (is_insert_sql(sql))
    {
      const row = await this.get_one<{ id: number }>('SELECT last_insert_rowid() as id')
      return row?.id ?? 0
    }

    return result.rowsAffected ?? 0
  },

  async exec(sql: string): Promise<void>
  {
    const db_handle = await get_db()
    await db_handle.execAsync(split_sql_script(sql).map((statement) => ({ sql: statement, args: [] })), false)
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
