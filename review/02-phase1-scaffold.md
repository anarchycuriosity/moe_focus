# 02 - Phase 1: 项目脚手架搭建实录

## 目标

从零搭建 MoeFocus Electron + React 项目骨架，确保全链路（开发→编译→打包）可运行。

## 技术决策记录

### 数据库选型：better-sqlite3 → sql.js

**问题**：better-sqlite3 v11.x 在 Node.js v26.1.0 (Windows) 上编译失败。

**根因**：Node v26 使用的 V8 引擎移除了已弃用的 `v8::Object::GetPrototype()` 方法，而 better-sqlite3 v11.x 的 C++ 原生绑定仍在使用该方法。

```
error C2039: "GetPrototype": 不是 "v8::Object" 的成员
```

**解决方案**：改用 `sql.js`（SQLite 的 WebAssembly 实现）。

**sql.js 优缺点**：
- 优点：100% JavaScript/WebAssembly，无需原生编译，跨平台零配置
- 缺点：API 不同（无同步的 prepare().run() 链式调用），需要手动 save() 持久化
- 性能：对日程管理这类低频率 CRUD 操作完全够用

**API 适配**：封装了 `DatabaseService` 类，提供以下方法保持类似 better-sqlite3 的语义：
- `run(sql, params?)` — 执行写操作并自动 save()
- `get(sql, params?)` — 返回单行
- `all(sql, params?)` — 返回多行
- `exec(sql)` — 执行多语句

<details>
<summary>sql.js 核心使用模式</summary>

```typescript
import initSqlJs from 'sql.js'

// 初始化（异步）
const SQL = await initSqlJs()

// 加载已有数据库或创建新数据库
const db = fs.existsSync(dbPath)
  ? new SQL.Database(fs.readFileSync(dbPath))
  : new SQL.Database()

// 运行 SQL
db.run('INSERT INTO tasks (title) VALUES (?)', ['Study'])

// 查询
const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?')
stmt.bind([1])
if (stmt.step()) {
  const row = stmt.getAsObject() // { id: 1, title: 'Study', ... }
}
stmt.free()

// 持久化
const buffer = Buffer.from(db.export())
fs.writeFileSync(dbPath, buffer)
```
</details>

## 文件结构

Phase 1 创建了以下文件：

### 配置文件 (6 files)
- `package.json` — 依赖声明，scripts
- `tsconfig.json` — TypeScript 项目引用根
- `tsconfig.node.json` — 主进程 TS 配置
- `tsconfig.web.json` — 渲染进程 TS 配置
- `electron.vite.config.ts` — electron-vite 构建配置
- `electron-builder.yml` — Windows NSIS 打包配置

### Electron 主进程 (5 files)
- `electron/main.ts` — 应用入口，BrowserWindow 创建
- `electron/preload.ts` — contextBridge，完整 electronAPI 表面
- `electron/ipc/index.ts` — 所有 IPC handler 注册
- `electron/services/DatabaseService.ts` — sql.js 封装
- `electron/database/schema.sql` — DDL + 默认设置

### React 渲染进程 (30+ files)
- 入口：`src/main.tsx`, `src/index.html`, `src/App.tsx`, `src/routes.tsx`
- 布局：`TitleBar`, `Sidebar`, `MainLayout`, `AnimeBackground` (各含 .module.css)
- 页面：`TodayPage`, `FocusPage`, `DiaryPage`, `StatisticsPage`, `SettingsPage` (stub)
- 公共组件：`MoeButton`, `MoeCard`, `MoeInput`
- 任务组件：`TaskLibrary`, `TodayPanel` (stub)
- 计时组件：`FocusTimer`, `SessionConfig` (视觉 stub)
- 样式系统：`global.css` (CSS 变量 + 基础样式), `theme.ts` (3 套主题色板)
- 类型系统：`electron.d.ts` (ElectronAPI 声明), `css.d.ts` (CSS Modules 声明), `models.ts`

## 关键实现细节

### 无边框窗口 + 自定义标题栏

```typescript
// main.ts
new BrowserWindow({
  frame: false,          // 移除系统标题栏
  titleBarStyle: 'hidden'
})
```

```css
/* TitleBar.module.css */
.drag-region { -webkit-app-region: drag; }   /* 可拖拽区域 */
.no-drag { -webkit-app-region: no-drag; }     /* 按钮区域 */
```

### IPC 通信模式

```
渲染进程 React 组件
  → window.electronAPI.xxx(args)    (通过 preload 暴露)
    → ipcRenderer.invoke('channel', args)
      → ipcMain.handle('channel', handler)   (主进程)
        → DatabaseService.instance.database
        → 返回结果
```

所有数据操作通过此路径，渲染进程无法直接访问 Node.js API 或文件系统。

### CSS 变量萌系主题

```css
:root {
  --moe-pink: #FFB7C5;        /* 主色 */
  --moe-lavender: #C9A9DC;    /* 辅助色 */
  --moe-mint: #B5EAD7;        /* 强调色 */
  --moe-radius: 16px;         /* 统一大圆角 */
  --moe-shadow: rgba(255, 183, 197, 0.25);  /* 粉色阴影 */
}
```

### 数据库即时持久化

sql.js 所有操作在内存中，每次 `run()` 后调用 `save()` 将整个数据库序列化写入磁盘。对于本地日程管理应用，数据量小（< 1MB），此方案无性能问题。

## 遇到的问题

1. **better-sqlite3 编译失败** → 改用 sql.js
2. **TypeScript 无法识别 CSS Modules** → 添加 `src/types/css.d.ts` 声明
3. **sql.js 的 Statement 类型在公共 API 中暴露** → 移除 prepare() 公共方法，所有查询通过 run/get/all 封装

## 验证结果

```
✓ electron-vite build 成功
  - out/main/index.js (17.56 kB)
  - out/preload/index.js (4.64 kB)
  - out/renderer/ (283.75 kB JS + 11.16 kB CSS)
```
