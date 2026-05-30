// ===== Phase 1: 项目脚手架 =====
// 应用入口 — BrowserWindow 创建、生命周期管理
// Phase 5: 添加 scheduler_service 自动任务调度

import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'           // Phase 1
import { DatabaseService } from './services/DatabaseService' // Phase 1
import { scheduler_service } from './services/SchedulerService' // Phase 5

let main_window: BrowserWindow | null = null

// Phase 1: 无边框窗口 + 自定义标题栏
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
    backgroundColor: '#FFF5EE',
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
  // Phase 1: 异步初始化数据库 (sql.js) 后注册所有 IPC handler
  await DatabaseService.instance.initialize()
  registerAllHandlers()
  // Phase 5: 启动定时任务 — 日记自动生成 + QQ邮箱提醒
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
