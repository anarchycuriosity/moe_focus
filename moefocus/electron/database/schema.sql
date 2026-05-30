-- MoeFocus Database Schema

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

CREATE TABLE IF NOT EXISTS wallpapers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  is_default  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 0,
  added_at    TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_todo_date ON todo_items(date);
CREATE INDEX IF NOT EXISTS idx_focus_date ON focus_sessions(date);
CREATE INDEX IF NOT EXISTS idx_focus_todo ON focus_sessions(todo_id);
CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(date);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('focus.defaultDuration', '25');
INSERT OR IGNORE INTO settings (key, value) VALUES ('focus.defaultRestDuration', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('diary.autoGenerateTime', '23:00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('diary.autoCommit', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('diary.autoPush', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('diary.rotateEnabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('diary.rotateInterval', '8');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email.reminderTime', '22:30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email.reminderEnabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('github.remoteUrl', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('github.branch', 'main');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ui.theme', 'sakura');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ui.chartType', 'bar');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ui.photoFrameEnabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('typora.path', '');
