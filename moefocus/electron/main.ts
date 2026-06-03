// ===== Phase 1: 项目脚手架 =====
// 应用入口 — BrowserWindow 创建、生命周期管理
// Phase 5: 添加 scheduler_service 自动任务调度

import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { DatabaseService } from './services/DatabaseService'
import { DiaryService } from './services/DiaryService'
import { scheduler_service } from './services/SchedulerService'
import { git_service } from './services/GitService'
import { export_sessions_from_db, import_sessions_to_db, sync_diary_entries_from_files } from './services/SyncService'

let main_window: BrowserWindow | null = null

function create_window(): void
{
  main_window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1A1A2E',
    show: false
  })

  main_window.on('ready-to-show', () =>
  {
    main_window?.show()
  })

  main_window.webContents.setWindowOpenHandler((details) =>
  {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
  {
    main_window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  }
  else
  {
    main_window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () =>
{
  // Register custom protocol for local file access (bypasses file:// CSP block)
  protocol.handle('local', (request) =>
  {
    const raw = decodeURIComponent(request.url.replace('local://', '').replace(/^\/+/, ''))
    // pathToFileURL handles non-ASCII chars (Chinese filenames etc.) correctly
    return net.fetch(pathToFileURL(raw).href)
  })

  await DatabaseService.instance.initialize()
  await registerAllHandlers()

  // Startup sync: init repo + sync from remote if configured
  try
  {
    await git_service.init_repo()
    const remote = await git_service.get_remote()
    if (remote.url) {
      const branch_row = DatabaseService.instance.get('SELECT value FROM settings WHERE key = ?', ['github.branch']) as { value: string } | undefined
      const branch = branch_row?.value || 'main'
      const user_data_path = app.getPath('userData')
      console.log('[sync] syncing from remote:', remote.url, 'branch:', branch)

      // Export local sessions before sync
      export_sessions_from_db(DatabaseService.instance, user_data_path)

      const result = await git_service.sync(branch)

      if (result.success)
      {
        // Import merged sessions into local DB
        const imported = import_sessions_to_db(DatabaseService.instance, user_data_path)
        if (imported > 0)
        {
          console.log('[sync] imported', imported, 'new sessions')
        }

        // Regenerate ALL diaries from DB (now has merged sessions)
        const dates = DatabaseService.instance.all(
          "SELECT DISTINCT date FROM focus_sessions WHERE status = 'completed' ORDER BY date"
        ) as Array<{ date: string }>
        let regenerated_count = 0
        for (const row of dates)
        {
          try
          {
            DiaryService.generate(row.date)
            regenerated_count++
          }
          catch (e)
          {
            console.error(`[sync] diary regeneration failed for ${row.date}:`, e)
          }
        }
        console.log('[sync] diaries regenerated:', regenerated_count)

        // Sync diary_entries from regenerated MD files
        const diary_synced = sync_diary_entries_from_files(DatabaseService.instance, user_data_path)
        console.log('[sync] diary entries regenerated:', diary_synced)

        // Commit and push regenerated diaries
        if (imported > 0 || result.new_from_remote.length > 0)
        {
          await git_service.commit('sync: regenerate diaries after startup merge')
          await git_service.push(branch)
        }
      }
    }
  }
  catch (e)
  {
    console.log('[sync] startup sync skipped:', e)
  }

  scheduler_service.start()
  create_window()

  app.on('activate', () =>
  {
    if (BrowserWindow.getAllWindows().length === 0)
    {
      create_window()
    }
  })
})

app.on('window-all-closed', () =>
{
  if (process.platform !== 'darwin')
  {
    app.quit()
  }
})

app.on('before-quit', () =>
{
  scheduler_service.stop()
  DatabaseService.instance.close()
})

export { main_window }
