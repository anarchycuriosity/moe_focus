import { ipcMain, BrowserWindow, dialog } from 'electron'
import { DatabaseService } from '../services/DatabaseService'
import { DiaryService } from '../services/DiaryService'
import { git_service } from '../services/GitService'
import { email_service } from '../services/EmailService'
import { main_window } from '../main'

export function registerAllHandlers(): void
{
  // Phase 1: 窗口控制 + 核心 CRUD (task/todo/focus/settings/file)
  registerWindowHandlers()
  registerTaskHandlers()
  registerTodoHandlers()
  registerFocusHandlers()
  // Phase 4: 日记生成与查询
  registerDiaryHandlers()
  // Phase 6: 统计聚合查询
  registerStatsHandlers()
  // Phase 8: 设置持久化
  registerSettingsHandlers()
  // Phase 5: Git 同步 + QQ 邮箱
  registerGitHandlers()
  registerEmailHandlers()
  // Phase 1: 文件操作 (Typora/壁纸)
  registerFileHandlers()
}

// ===== Phase 1: 窗口控制 — 无边框窗口的最小化/最大化/关闭 =====
function registerWindowHandlers(): void
{
  ipcMain.handle('window:minimize', () =>
  {
    BrowserWindow.getFocusedWindow()?.minimize()
  })

  ipcMain.handle('window:maximize', () =>
  {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized())
    {
      win.unmaximize()
    }
    else
    {
      win?.maximize()
    }
  })

  ipcMain.handle('window:close', () =>
  {
    BrowserWindow.getFocusedWindow()?.close()
  })

  ipcMain.handle('window:isMaximized', () =>
  {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
  })
}

// ===== Phase 2: 任务 CRUD — 预设任务库的增删改查 =====
function registerTaskHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('task:getAll', () =>
  {
    return db().all('SELECT * FROM tasks WHERE is_active = 1 ORDER BY sort_order')
  })

  ipcMain.handle('task:create', (_event, task) =>
  {
    db().run(
      'INSERT INTO tasks (title, category, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)',
      [task.title, task.category || 'General', task.icon || 'star', task.color || '#FFB7C5', task.sort_order || 0]
    )
    const id_row = db().get('SELECT MAX(id) as new_id FROM tasks')
    const new_id = (id_row as { new_id: number } | undefined)?.new_id ?? 0
    if (new_id === 0) return null
    return db().get('SELECT * FROM tasks WHERE id = ?', [new_id]) || null
  })

  ipcMain.handle('task:update', (_event, id, data) =>
  {
    const fields: string[] = []
    const values: unknown[] = []
    for (const [key, value] of Object.entries(data))
    {
      fields.push(`${key} = ?`)
      values.push(value)
    }
    if (fields.length === 0) return null
    fields.push("updated_at = datetime('now')")
    values.push(id)
    db().run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values)
    return db().get('SELECT * FROM tasks WHERE id = ?', [id])
  })

  ipcMain.handle('task:delete', (_event, id) =>
  {
    db().run("UPDATE tasks SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [id])
    return { success: true }
  })
}

// ===== Phase 2: TODO CRUD + 拖拽排序 =====
function registerTodoHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('todo:getByDate', (_event, date) =>
  {
    return db().all(
      `SELECT ti.*, t.title as task_title, t.color as task_color, t.icon as task_icon
       FROM todo_items ti
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE ti.date = ?
       ORDER BY ti.sort_order`,
      [date]
    )
  })

  ipcMain.handle('todo:add', (_event, item) =>
  {
    const max_row = db().get(
      'SELECT COALESCE(MAX(sort_order), -1) as max_ord FROM todo_items WHERE date = ?',
      [item.date]
    ) as { max_ord: number }
    const next_order = max_row.max_ord + 1

    db().run(
      'INSERT INTO todo_items (task_id, custom_title, date, sort_order) VALUES (?, ?, ?, ?)',
      [item.task_id || null, item.custom_title || null, item.date, next_order]
    )

    // Use MAX(id) instead of last_insert_rowid() for sql.js compatibility
    const id_row = db().get('SELECT MAX(id) as new_id FROM todo_items WHERE date = ?', [item.date])
    const new_id = (id_row as { new_id: number } | undefined)?.new_id ?? 0
    console.log('[IPC] todo:add, new_id:', new_id)

    if (new_id === 0) return null

    const result = db().get(
      `SELECT ti.*, t.title as task_title, t.color as task_color, t.icon as task_icon
       FROM todo_items ti
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE ti.id = ?`,
      [new_id]
    )
    console.log('[IPC] todo:add result:', result)
    return result
  })

  ipcMain.handle('todo:update', (_event, id, data) =>
  {
    const fields: string[] = []
    const values: unknown[] = []
    for (const [key, value] of Object.entries(data))
    {
      fields.push(`${key} = ?`)
      values.push(value)
    }
    if (fields.length === 0) return null
    fields.push("updated_at = datetime('now')")
    values.push(id)
    db().run(`UPDATE todo_items SET ${fields.join(', ')} WHERE id = ?`, values)
    return db().get(
      `SELECT ti.*, t.title as task_title, t.color as task_color, t.icon as task_icon
       FROM todo_items ti
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE ti.id = ?`,
      [id]
    )
  })

  ipcMain.handle('todo:remove', (_event, id) =>
  {
    db().run('DELETE FROM todo_items WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('todo:reorder', (_event, ids) =>
  {
    for (let i = 0; i < ids.length; i++)
    {
      db().run('UPDATE todo_items SET sort_order = ? WHERE id = ?', [i, ids[i]])
    }
    return { success: true }
  })
}

// ===== Phase 3: 专注会话 — start/pause/resume/complete/abandon =====
function registerFocusHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('focus:start', (_event, session) =>
  {
    db().run(
      `INSERT INTO focus_sessions (todo_id, subject, planned_duration_min, rest_duration_sec, date, status)
       VALUES (?, ?, ?, ?, ?, 'running')`,
      [session.todo_id || null, session.subject, session.planned_duration_min, session.rest_duration_sec || 0, session.date]
    )
    // Use MAX(id) instead of last_insert_rowid for sql.js compat
    const id_row = db().get('SELECT MAX(id) as new_id FROM focus_sessions')
    const new_id = (id_row as { new_id: number } | undefined)?.new_id ?? 0
    if (new_id === 0) return null
    return db().get('SELECT * FROM focus_sessions WHERE id = ?', [new_id])
  })

  ipcMain.handle('focus:pause', (_event, id) =>
  {
    db().run("UPDATE focus_sessions SET status = 'paused' WHERE id = ?", [id])
    return { success: true }
  })

  ipcMain.handle('focus:resume', (_event, id) =>
  {
    db().run("UPDATE focus_sessions SET status = 'running' WHERE id = ?", [id])
    return { success: true }
  })

  ipcMain.handle('focus:complete', (_event, id, actual_sec) =>
  {
    db().run(
      "UPDATE focus_sessions SET status != 'running' AND status != 'paused', actual_duration_sec = ?, ended_at = datetime('now') WHERE id = ?",
      [actual_sec, id]
    )
    return { success: true }
  })

  ipcMain.handle('focus:abandon', (_event, id, actual_sec) =>
  {
    db().run(
      "UPDATE focus_sessions SET status = 'abandoned', actual_duration_sec = ?, ended_at = datetime('now') WHERE id = ?",
      [actual_sec || 0, id]
    )
    return { success: true }
  })

  ipcMain.handle('focus:getCurrent', () =>
  {
    return db().get(
      "SELECT * FROM focus_sessions WHERE status IN ('running', 'paused') ORDER BY started_at DESC LIMIT 1"
    )
  })

  ipcMain.handle('focus:getByDate', (_event, date) =>
  {
    return db().all(
      `SELECT fs.*, ti.custom_title, t.title as task_title
       FROM focus_sessions fs
       LEFT JOIN todo_items ti ON fs.todo_id = ti.id
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE fs.date = ?
       ORDER BY fs.started_at DESC`,
      [date]
    )
  })
}

// ===== Phase 4: 日记生成/查询/反思 =====
function registerDiaryHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('diary:getByDate', (_event, date) =>
  {
    return db().get('SELECT * FROM diary_entries WHERE date = ?', [date])
  })

  ipcMain.handle('diary:saveReflection', (_event, date, text) =>
  {
    const existing = db().get('SELECT id FROM diary_entries WHERE date = ?', [date])
    if (existing)
    {
      db().run(
        "UPDATE diary_entries SET reflection_text = ?, updated_at = datetime('now') WHERE date = ?",
        [text, date]
      )
    }
    else
    {
      db().run(
        "INSERT INTO diary_entries (date, reflection_text) VALUES (?, ?)",
        [date, text]
      )
    }
    return { success: true }
  })

  ipcMain.handle('diary:listAll', () =>
  {
    return db().all('SELECT date, file_path, mood FROM diary_entries ORDER BY date DESC')
  })

  ipcMain.handle('diary:generate', (_event, date) =>
  {
    const result = DiaryService.generate(date)
    return { success: true, date, file_path: result.file_path, content: result.content }
  })

  ipcMain.handle('diary:deleteEntry', (_event, date) =>
  {
    db().run('DELETE FROM diary_entries WHERE date = ?', [date])
    return { success: true }
  })
}

// ===== Phase 6: 统计聚合 — 周/月/事项 =====
function registerStatsHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('stats:getWeekly', (_event, week_start) =>
  {
    return db().all(
      `SELECT date, SUM(actual_duration_sec) as total_seconds
       FROM focus_sessions
       WHERE date >= ? AND date < date(?, '+7 days') AND status != 'running' AND status != 'paused'
       GROUP BY date
       ORDER BY date`,
      [week_start, week_start]
    )
  })

  ipcMain.handle('stats:getMonthly', (_event, month) =>
  {
    return db().all(
      `SELECT date,
              CAST(strftime('%W', date) AS INTEGER) -
              CAST(strftime('%W', ? || '-01') AS INTEGER) + 1 AS week_of_month,
              strftime('%w', date) AS day_of_week,
              SUM(actual_duration_sec) as total_seconds
       FROM focus_sessions
       WHERE strftime('%Y-%m', date) = ? AND status != 'running' AND status != 'paused'
       GROUP BY date
       ORDER BY date`,
      [month, month]
    )
  })

  ipcMain.handle('stats:getFocusItems', (_event, start_date, end_date) =>
  {
    return db().all(
      `SELECT COALESCE(t.title, fs.subject) as label,
              COALESCE(t.color, '#FFB7C5') as color,
              SUM(fs.actual_duration_sec) as total_seconds
       FROM focus_sessions fs
       LEFT JOIN todo_items ti ON fs.todo_id = ti.id
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE fs.date BETWEEN ? AND ? AND fs.status != 'running' AND status != 'paused'
       GROUP BY label
       ORDER BY total_seconds DESC`,
      [start_date, end_date]
    )
  })
}

// ===== Phase 8: 设置持久化 — 键值对读写 + 变更通知 =====
function registerSettingsHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('settings:get', (_event, key) =>
  {
    const row = db().get('SELECT value FROM settings WHERE key = ?', [key]) as { value: string } | undefined
    return row ? row.value : null
  })

  ipcMain.handle('settings:getAll', () =>
  {
    const rows = db().all('SELECT key, value FROM settings') as { key: string; value: string }[]
    const result: Record<string, string> = {}
    for (const row of rows)
    {
      result[row.key] = row.value
    }
    return result
  })

  ipcMain.handle('settings:set', (_event, key, value) =>
  {
    const str_value = typeof value === 'string' ? value : JSON.stringify(value)
    db().run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')",
      [key, str_value, str_value]
    )

    for (const win of BrowserWindow.getAllWindows())
    {
      win.webContents.send('settings:changed', { key, value: str_value })
    }
    return { success: true }
  })
}

// ===== Phase 5: Git 同步 — commit/push/pull/remote =====
function registerGitHandlers(): void
{
  ipcMain.handle('git:getStatus', async () => git_service.getStatus())
  ipcMain.handle('git:commit', async (_event, message) => git_service.commit(message))
  ipcMain.handle('git:push', async () => git_service.push())
  ipcMain.handle('git:pull', async () => git_service.pull())
  ipcMain.handle('git:setRemote', async (_event, url) => git_service.set_remote(url))
  ipcMain.handle('git:getRemote', async () => git_service.get_remote())
  ipcMain.handle('git:initRepo', async () => git_service.init_repo())
}

// ===== Phase 5: QQ 邮箱 — 发送/提醒/测试连接 =====
function registerEmailHandlers(): void
{
  const db = () => DatabaseService.instance

  ipcMain.handle('email:send', async (_event, to, subject, body) =>
  {
    const user = db().get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
    const pass = db().get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])
    if (!user || !pass) return { success: false, error: 'QQ邮箱未配置' }
    return email_service.send(to, subject, body, (user as { value: string }).value, (pass as { value: string }).value)
  })

  ipcMain.handle('email:sendReminder', async (_event, date) =>
  {
    const user = db().get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
    const pass = db().get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])
    if (!user || !pass) return { success: false, error: 'QQ邮箱未配置' }
    const diary = db().get('SELECT summary_text FROM diary_entries WHERE date = ?', [date])
    return email_service.send_reminder(date, (user as { value: string }).value, (pass as { value: string }).value, (user as { value: string }).value, (diary as { summary_text: string } | undefined)?.summary_text || '')
  })

  ipcMain.handle('email:testConnection', async (_event, user, pass) =>
    email_service.test_connection(user, pass))
}

// ===== Phase 1: 文件系统 — Typora/壁纸/图片选择 =====
// Phase 4 补充: openInTypora; Phase 7 补充: setWallpaper
function registerFileHandlers(): void
{
  ipcMain.handle('file:openInTypora', async (_event, file_path) =>
  {
    const { exec } = await import('child_process')
    const typora_path = 'C:\\Program Files\\Typora\\Typora.exe'
    exec(`"${typora_path}" "${file_path}"`, (error) =>
    {
      if (error) console.error('Failed to open Typora:', error)
    })
    return { success: true }
  })

  ipcMain.handle('file:pickImage', async () =>
  {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('file:setWallpaper', async (_event, file_path) =>
  {
    // Just store the path — no copying, use local file directly
    const db = () => DatabaseService.instance
    db().run('UPDATE wallpapers SET is_active = 0')

    const file_name = file_path.split(/[\\/]/).pop() || 'wallpaper.png'
    db().run(
      'INSERT INTO wallpapers (file_name, file_path, is_active) VALUES (?, ?, 1)',
      [file_name, file_path]
    )

    return file_path
  })

  ipcMain.handle('file:openWallpapersFolder', async () =>
  {
    const { app } = await import('electron')
    const { join } = await import('path')
    const { shell } = await import('electron')
    const dir = join(app.getAppPath(), 'wallpapers')
    shell.openPath(dir)
    return { success: true }
  })
}
