import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { DatabaseService } from '../services/DatabaseService'
import { DiaryService } from '../services/DiaryService'
import { git_service } from '../services/GitService'
import { email_service } from '../services/EmailService'
import { export_sessions_from_db, import_sessions_to_db, sync_diary_entries_from_files } from '../services/SyncService'
import { main_window } from '../main'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function registerAllHandlers(): Promise<void>
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
  // Phase 1: 文件操作 (Typora/壁纸) — async for dynamic imports
  await registerFileHandlers()
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
    const session_uuid = randomUUID()
    db().run(
      `INSERT INTO focus_sessions (todo_id, subject, planned_duration_min, rest_duration_sec, date, status, uuid)
       VALUES (?, ?, ?, ?, ?, 'running', ?)`,
      [session.todo_id || null, session.subject, session.planned_duration_min, session.rest_duration_sec || 0, session.date, session_uuid]
    )
    // Use MAX(id) instead of last_insert_rowid for sql.js compat
    const id_row = db().get('SELECT MAX(id) as new_id FROM focus_sessions')
    const new_id = (id_row as { new_id: number } | undefined)?.new_id ?? 0
    if (new_id === 0) return null
    return db().get('SELECT * FROM focus_sessions WHERE id = ?', [new_id])
  })

  ipcMain.handle('focus:pause', (_event, id, actual_sec) =>
  {
    db().run(
      "UPDATE focus_sessions SET status = 'paused', actual_duration_sec = ? WHERE id = ?",
      [actual_sec || 0, id]
    )
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
      "UPDATE focus_sessions SET status = 'completed', actual_duration_sec = ?, ended_at = datetime('now') WHERE id = ?",
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
    // 级联删除同日期 focus_sessions
    const session_result = db().run('DELETE FROM focus_sessions WHERE date = ?', [date])
    const deleted_sessions = db().get('SELECT changes() as n') as { n: number }

    // 删除日记条目
    db().run('DELETE FROM diary_entries WHERE date = ?', [date])

    // 删除 sums/ 文件
    const sums_dir = join(app.getPath('userData'), 'sums')
    const file_path = join(sums_dir, `${date}.md`)
    if (existsSync(file_path))
    {
      unlinkSync(file_path)
    }

    return { success: true, deleted_sessions: deleted_sessions.n }
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
       WHERE date >= ? AND date < date(?, '+7 days') AND status = 'completed'
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
       WHERE strftime('%Y-%m', date) = ? AND status = 'completed'
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
       WHERE fs.date BETWEEN ? AND ? AND fs.status = 'completed'
       GROUP BY label
       ORDER BY total_seconds DESC`,
      [start_date, end_date]
    )
  })

  ipcMain.handle('stats:getWeeklyBreakdown', (_event, week_start) =>
  {
    return db().all(
      `SELECT fs.date,
              COALESCE(t.title, fs.subject) as subject,
              COALESCE(t.color, '#FFB7C5') as color,
              SUM(fs.actual_duration_sec) as total_seconds
       FROM focus_sessions fs
       LEFT JOIN todo_items ti ON fs.todo_id = ti.id
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE fs.date >= ? AND fs.date < date(?, '+7 days')
         AND fs.status = 'completed'
       GROUP BY fs.date, subject
       ORDER BY fs.date, total_seconds DESC`,
      [week_start, week_start]
    )
  })

  ipcMain.handle('stats:getMonthlyBreakdown', (_event, month) =>
  {
    return db().all(
      `SELECT fs.date,
              COALESCE(t.title, fs.subject) as subject,
              COALESCE(t.color, '#FFB7C5') as color,
              SUM(fs.actual_duration_sec) as total_seconds
       FROM focus_sessions fs
       LEFT JOIN todo_items ti ON fs.todo_id = ti.id
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE strftime('%Y-%m', fs.date) = ?
         AND fs.status = 'completed'
       GROUP BY fs.date, subject
       ORDER BY fs.date, total_seconds DESC`,
      [month]
    )
  })

  // 清理孤儿 focus_sessions：删除那些日期没有对应 diary_entry 的会话
  ipcMain.handle('stats:syncCleanup', () =>
  {
    const result = db().run(
      `DELETE FROM focus_sessions
       WHERE date NOT IN (SELECT DISTINCT date FROM diary_entries)`
    )
    const changes = db().get('SELECT changes() as n') as { n: number }
    return { success: true, cleaned_sessions: changes.n }
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
  const db = () => DatabaseService.instance

  const get_branch = (): string =>
  {
    const row = db().get('SELECT value FROM settings WHERE key = ?', ['github.branch']) as { value: string } | undefined
    return row?.value || 'main'
  }

  ipcMain.handle('git:getStatus', async () => git_service.getStatus())
  ipcMain.handle('git:checkSyncStatus', async () =>
  {
    const branch = get_branch()
    return git_service.check_sync_status(branch)
  })
  ipcMain.handle('git:commit', async (_event, message) => git_service.commit(message))
  ipcMain.handle('git:push', async () =>
  {
    const branch = get_branch()
    return git_service.push(branch)
  })
  ipcMain.handle('git:pull', async () =>
  {
    const branch = get_branch()
    return git_service.pull(branch)
  })
  ipcMain.handle('git:setRemote', async (_event, url) => git_service.set_remote(url))
  ipcMain.handle('git:getRemote', async () => git_service.get_remote())
  ipcMain.handle('git:initRepo', async () => git_service.init_repo())
  ipcMain.handle('git:sync', async () =>
  {
    const branch = get_branch()
    const user_data_path = app.getPath('userData')

    // 1. Export local sessions to data/focus_sessions.json before sync
    export_sessions_from_db(db(), user_data_path)

    // 2. Sync: JSON UUID merge + commit + push (MD files are NOT merged —
    //    semantic merge doubles totals on repeated syncs)
    const result = await git_service.sync(branch)

    if (result.success)
    {
      // 3. Import sessions from merged JSON into local DB (UUID dedup)
      const imported = import_sessions_to_db(db(), user_data_path)
      if (imported > 0)
      {
        result.imported_sessions = imported
      }

      // 4. Regenerate ALL diaries from DB for dates that have completed sessions.
      //    After JSON import, the DB has the complete session set. Regenerating
      //    from DB produces correct MD files (totals = local + imported sessions).
      //    DiaryService.generate() updates both sums/*.md and diary_entries.
      const dates = db().all(
        "SELECT DISTINCT date FROM focus_sessions WHERE status = 'completed' ORDER BY date"
      ) as Array<{ date: string }>
      for (const row of dates)
      {
        DiaryService.generate(row.date)
      }

      // 5. Safety net: sync diary_entries from regenerated MD files.
      //    Handles dates that have MD files but no sessions (e.g. remote-only diaries).
      const diary_synced = sync_diary_entries_from_files(db(), user_data_path)
      if (diary_synced > 0)
      {
        result.merged_files = [`${diary_synced} diary entries regenerated`]
      }

      // 6. Commit and push regenerated diaries if new sessions were imported
      if (imported > 0 || result.new_from_remote.length > 0)
      {
        await git_service.commit('sync: regenerate diaries after session merge')
        await git_service.push(branch)
      }
    }

    return result
  })
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
async function registerFileHandlers(): Promise<void>
{
  const { existsSync, readdirSync } = await import('fs')
  const { join } = await import('path')
  const { app } = await import('electron')

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

  ipcMain.handle('file:getWallpaperForPage', (_event, page: string) =>
  {
    const wallpapers_dir = join(app.getAppPath(), 'wallpapers')
    if (!existsSync(wallpapers_dir)) return null

    const files = readdirSync(wallpapers_dir)
    const match = files.find((f) =>
    {
      const lower = f.toLowerCase()
      return lower.startsWith(page.toLowerCase() + '.')
    })
    return match ? join(wallpapers_dir, match) : null
  })

  ipcMain.handle('file:getDiaryPictures', () =>
  {
    const diary_dir = join(app.getAppPath(), 'diary-pictures')
    if (!existsSync(diary_dir)) return []
    const files = readdirSync(diary_dir)
    const image_exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
    return files
      .filter((f) => image_exts.some((ext) => f.toLowerCase().endsWith(ext)))
      .map((f) => join(diary_dir, f))
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

  ipcMain.handle('file:getActiveWallpaper', () =>
  {
    const row = db().get('SELECT file_path FROM wallpapers WHERE is_active = 1 ORDER BY added_at DESC LIMIT 1')
    return row ? (row as { file_path: string }).file_path : null
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
