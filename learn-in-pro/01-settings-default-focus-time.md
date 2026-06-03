# 01 — 数据流：为什么设置了默认时长却不生效？

## 问题现象

在「设置 → 计时」标签页修改默认专注时长为 45 分钟，保存。回到专注页面，计时器仍然显示 25 分钟。重启应用也不行。

---

## 一、前置知识

### 1.1 什么叫"数据流"（Data Flow）？

想象一家餐厅。

你在菜单上写「三分熟牛排」递给服务员 → 服务员把菜单送到后厨 → 厨师**从来不去看那张菜单**，他只按自己记住的默认做法做全熟牛排 → 你吃到的永远是全熟。

这个餐厅的问题在于：**数据被正确递交了，但没有人在需要的时候去读取它**。

在软件中，数据流描述的是一条完整的链路：

```
数据产生（写入端） → 数据传输（中间层） → 数据消费（读取端）
```

你需要回答三个问题：

| 问题 | 餐厅类比 | 软件类比 |
|------|---------|---------|
| 数据在哪产生？ | 你在菜单上写字 | 用户在设置页修改时长 |
| 数据经过哪里？ | 服务员 → 后厨窗口 | IPC → 数据库 |
| 谁在什么时候读取？ | 厨师做菜前 | 计时器组件初始化时 |

如果读取端缺失，链路就是断的。

### 1.2 Electron 的双进程架构

理解 MoeFocus，首先要理解 Electron 应用的基本结构。

Electron 应用由两个"进程"组成。进程是操作系统分配资源的基本单位——你可以把它理解为"一个独立运行的程序实例"。

```
┌─────────────────────────────────────────────────────┐
│                    MoeFocus 应用                      │
│                                                     │
│  ┌─────────────────────────┐  ┌──────────────────┐  │
│  │   渲染进程 (Renderer)     │  │  主进程 (Main)    │  │
│  │                         │  │                  │  │
│  │  React / HTML / CSS     │  │  Node.js 运行时   │  │
│  │  用户看到的界面           │  │                  │  │
│  │                         │  │  • 读写数据库      │  │
│  │  ⚠ 不能直接：            │  │  • 读写文件系统    │  │
│  │  - 读文件系统            │  │  • 执行系统命令    │  │
│  │  - 操作数据库            │  │  • 管理窗口       │  │
│  │  - 调用系统 API          │  │                  │  │
│  │                         │  │  ← 完整的系统权限  │  │
│  │  受限的浏览器环境         │  │                  │  │
│  └──────────┬──────────────┘  └────────┬─────────┘  │
│             │          IPC 通道        │             │
│             └──────────────────────────┘             │
│         ipcRenderer.invoke()    ipcMain.handle()     │
└─────────────────────────────────────────────────────┘
```

为什么要做这个隔离？**安全性**。

假设你的 Electron 应用内嵌了一个第三方网页。如果渲染进程拥有完整的系统权限，那个网页里的 JavaScript 就能：
1. 读取你电脑上所有文件
2. 上传到黑客的服务器
3. 删除你的数据

这就是**沙盒模型**（Sandbox）：把危险的代码关在笼子里，它想做什么坏事都做不到。

> **经典源码学习**：这是 Chromium 浏览器安全模型在桌面端的应用。Chrome 的每个标签页就是一个独立的渲染进程，相互隔离且受限。Electron 继承了这个架构。相关源码见 Chromium 的 `//content/browser/renderer_host/` 目录。

### 1.3 IPC：进程间通信

既然渲染进程被限制了，它怎么操作数据库呢？通过**进程间通信（Inter-Process Communication, IPC）**。

IPC 就像打电话——渲染进程拿起话筒说「帮我查一下设置」，主进程听到后去查数据库，查完了说「结果是 45」。

```
渲染进程（Renderer）                   主进程（Main）
    │                                      │
    │  1. ipcRenderer.invoke(              │
    │     'settings:get',                  │
    │     'focus.defaultDuration'          │
    │  )                                   │
    │────────────────────────────────────→ │
    │                                      │ 2. ipcMain.handle(
    │                                      │    'settings:get', 
    │                                      │    (event, key) => {
    │                                      │      return db.get(
    │                                      │        'SELECT value 
    │                                      │         FROM settings 
    │                                      │         WHERE key=?', 
    │                                      │        [key]
    │                                      │      )
    │                                      │    }
    │                                      │  )
    │  3. 返回 '45'                         │
    │ ←────────────────────────────────── │
    │                                      │
    │  4. 更新 UI 显示 45 分钟              │
```

在 MoeFocus 中，IPC 链路涉及三个文件：

| 文件 | 角色 | 做什么 |
|------|------|--------|
| `electron/preload.ts` | 桥接层 | 用 `contextBridge.exposeInMainWorld` 把主进程 API 暴露给渲染进程 |
| `electron/ipc/index.ts` | 处理器 | 用 `ipcMain.handle` 注册每个 IPC 消息的处理函数 |
| 前端组件 | 调用者 | 通过 `window.electronAPI.xxx()` 发起 IPC 请求 |

> **经典源码学习**：IPC 的概念源自微内核操作系统（如 Mach）。在 Mach 中，所有系统服务都通过 IPC 消息传递，内核只负责消息路由。Electron 的 IPC 本质上也是消息传递模型。如果你对这方面感兴趣，可以看 XNU 内核（macOS/iOS 的内核）的 `ipc/` 目录。

### 1.4 状态与持久化

**状态（State）** 是程序在任何时刻"记住"的所有信息。

```
用户设置默认时长为 45 分钟 →
  ├─ 内存中的状态（Zustand store）→ focus_duration_min = 45  ← 程序关了就没
  └─ 硬盘上的状态（SQLite 数据库）→ settings 表存了 {key: 'focus.defaultDuration', value: '45'}  ← 永久保留
```

状态管理的关键模式：

```
应用启动
  → 从持久层（数据库）读取配置 → 恢复到内存层（Zustand store）
  → 用户在 UI 修改配置
  → 同时写入内存层（即时生效）和持久层（重启后保留）
```

在 MoeFocus 中，Zustand 管理内存状态，SQLite 管理持久状态。两者需要同步，否则就会出现"数据库里存了 45，但 UI 显示 25"的问题。

> **经典源码学习**：Zustand 是一个极简的状态管理库，核心代码不到 500 行。它的源码是学习"发布-订阅模式"的最佳入门材料。核心机制：`createStore` → 用 `useSyncExternalStoreWithSelector` 订阅 React 更新。建议阅读：`zustand/src/vanilla.ts` 和 `zustand/src/react.ts`。

### 1.5 React 的 useEffect：组件何时执行副作用

在 React 中，组件渲染是"纯"的——给定相同的 props 和 state，输出相同的 JSX。但真实应用需要**副作用**（Side Effect）：网络请求、读写数据库、设置定时器等。

`useEffect` 就是 React 提供的副作用执行机制：

```typescript
useEffect(() => {
  // 副作用代码在这里执行

  return () => {
    // 清理函数（可选）：组件卸载时执行
  }
}, [依赖数组])
```

三种依赖数组的含义：

```typescript
useEffect(() => { ... })           // 无第二个参数 = 每次渲染后都执行
useEffect(() => { ... }, [])       // 空数组 = 只在组件首次挂载时执行一次
useEffect(() => { ... }, [a, b])   // 有依赖 = 依赖变化时执行
```

对于"加载默认设置"这个场景，使用空依赖数组 `[]` 最合适：只在组件首次出现在屏幕上时从数据库加载一次。

---

## 二、根因分析

### 2.1 追踪完整的数据流

从用户点击保存开始，追踪数据应该走的完整路径：

**写入端（正常）**：

```
用户修改输入框为 45 分钟
  → SettingsPage 调用 window.electronAPI.settings.set('focus.defaultDuration', '45')
  → preload.ts 转发 IPC
  → ipc/index.ts: settings:set handler
  → db.run("INSERT INTO settings ... ON CONFLICT UPDATE ...")
  → SQLite settings 表写入成功 ✓
  → 数据持久化到硬盘 ✓
```

**读取端（断裂）**：

```
SessionConfig 组件挂载到屏幕上
  → 从 useFocusStore 读取配置
  → initial_state: { focus_duration_min: 25, rest_duration_min: 5 }  ← 写死的！
  → 没有 IPC 调用去读 settings 表
  → 显示 25 分钟 ✗
```

**数据流断裂点**：写入端和传输路径都正常，但读取端从未被实现。

### 2.2 为什么这是后端开发中最常见的 bug 模式？

任何一个配置功能，都需要确认四个环节：

```
① 写入端（Write）      ② 传输路径（Transport）   ③ 读取端（Read）       ④ 读取时机（Timing）
SettingsPage           IPC + SQLite             SessionConfig         组件挂载时
    ✓                       ✓                       ✗                    ✗
```

这四个环节中缺少任何一个，功能就不完整。很多初学者只关注写入端——写完 `settings.set()` 就认为功能完成了。

---

## 三、修复方案

在 `SessionConfig` 组件挂载时，通过 IPC 从数据库加载默认值：

```typescript
// moefocus/src/components/timer/SessionConfig.tsx

useEffect(() =>
{
  async function load_defaults()
  {
    // ==========================================
    // 第一步：通过 IPC 从主进程数据库读取设置
    // ==========================================
    // 注意：IPC 调用是异步的（Promise），需要 await
    // 数据库中所有值都是字符串，需要手动转换类型
    const focus_str = await window.electronAPI.settings.get(
      'focus.defaultDuration'
    )
    const rest_str = await window.electronAPI.settings.get(
      'focus.defaultRestDuration'
    )

    // ==========================================
    // 第二步：类型转换 + 兜底默认值
    // ==========================================
    // parseInt 把字符串 "45" 转成数字 45
    // 第二个参数 10 表示十进制（避免 "0x" 开头的字符串被当成十六进制）
    // || 25 是兜底：如果数据库里没有这个设置（返回 null/undefined）
    // parseInt(null, 10) 返回 NaN (Not a Number)
    // NaN 是 falsy 值，所以会回退到 || 后面的默认值 25
    const focus_val = focus_str ? parseInt(focus_str, 10) : 25
    const rest_val  = rest_str  ? parseInt(rest_str, 10)  : 5

    // ==========================================
    // 第三步：参数校验 → 更新内存中的状态
    // ==========================================
    // 防御性编程：确保值在合理范围内
    // 如果有人误把数据库中的值改成了负数，这里不会应用它
    if (focus_val > 0 && rest_val >= 0)
    {
      set_config(focus_val, rest_val)   // 更新 Zustand store → UI 自动刷新
    }
  }

  load_defaults()   // 调用这个异步函数
}, [])              // 空依赖 = 仅在组件首次挂载时执行一次
```

修复后的完整数据流：

```
SessionConfig 挂载
  → useEffect 触发 (仅此一次)
  → ipcRenderer.invoke('settings:get', 'focus.defaultDuration')
  → [IPC 通道传输]
  → ipcMain.handle('settings:get', (e, key) => db.get(...))
  → DatabaseService.get('SELECT value FROM settings WHERE key=?', [key])
  → SQLite 查询 → 返回 { value: '45' }
  → [IPC 通道返回]
  → '45'
  → parseInt('45', 10) → 45
  → 45 > 0 → set_config(45, 5)
  → Zustand store 更新
  → React 响应式更新 → UI 显示 45 分钟 ✓
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| 数据流闭环 | 配置功能 = 写入端 × 传输路径 × 读取端 × 读取时机，四者缺一不可 |
| Electron 双进程 | 渲染进程管界面（受限），主进程管系统（完整权限），IPC 是桥梁 |
| IPC 异步性 | `ipcRenderer.invoke` 返回 Promise，必须 `await` — 网络请求同理 |
| 持久化两层模型 | 内存（Zustand / 快）+ 硬盘（SQLite / 慢），启动时从硬盘恢复到内存 |
| 防御性编程 | 从外部来源读取的数据永远是字符串且可能不存在，parseInt + fallback 是基本操作 |
| useEffect | React 的副作用机制，空依赖 `[]` = 只在挂载时执行一次 |

---

## 五、项目作业：构建你自己的配置管理系统

### 作业目标

用 **纯 Node.js + SQLite** 构建一个命令行配置管理器，实践本节所学的数据流闭环。

### 核心要求

```
1. 创建一个 CLI 工具，支持以下命令：
   config set <key> <value>     → 写入配置
   config get <key>             → 读取配置
   config list                  → 列出所有配置

2. 配置存储在 SQLite 数据库中（使用 better-sqlite3）

3. 每次读取时要能从数据库加载最新值（不能缓存过期值！）

4. 未设置的 key 要有合理的默认值（不能用 undefined/null 显示给用户）
```

### 项目结构建议

```
my-config/
├── package.json
├── src/
│   ├── index.ts          # CLI 入口，解析命令行参数
│   ├── database.ts       # 数据库连接和初始化
│   ├── config-service.ts # 配置读写逻辑
│   └── defaults.ts       # 默认值定义
```

### 关键代码骨架

```typescript
// database.ts — 数据库初始化
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

// 数据存在用户主目录下，类似 MoeFocus 的 %APPDATA%/moefocus/
const DB_PATH = path.join(os.homedir(), '.my-config', 'config.db')

export function init_db(): Database.Database
{
  const db = new Database(DB_PATH)

  // 启用 WAL 模式提升并发性能
  db.pragma('journal_mode = WAL')

  // 创建 settings 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  return db
}
```

```typescript
// config-service.ts — 配置读写
import type Database from 'better-sqlite3'

// 默认值表 — 这就是 MoeFocus 中 schema.sql 的 INSERT OR IGNORE 做的事情
const DEFAULTS: Record<string, string> = {
  'theme': 'dark',
  'language': 'zh-CN',
  'page_size': '20',
}

export function get_config(db: Database.Database, key: string): string
{
  const row = db.prepare(
    'SELECT value FROM settings WHERE key = ?'
  ).get(key) as { value: string } | undefined

  // 数据流闭环的关键：数据库没有 → 回退到默认值
  return row?.value ?? DEFAULTS[key] ?? ''
}

export function set_config(db: Database.Database, key: string, value: string): void
{
  // UPSERT: 存在就更新，不存在就插入
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `).run(key, value, value)
}

export function list_config(db: Database.Database): Record<string, string>
{
  const rows = db.prepare(
    'SELECT key, value FROM settings'
  ).all() as { key: string; value: string }[]

  // 合并默认值：数据库中已设置的覆盖默认值
  const result = { ...DEFAULTS }
  for (const row of rows)
  {
    result[row.key] = row.value
  }
  return result
}
```

### 验收标准

- [ ] `config set port 8080` → 写入成功
- [ ] `config get port` → 返回 `8080`
- [ ] `config get nonexistent_key` → 返回默认值或提示"未设置"
- [ ] 退出程序后重新运行 `config get port` → 仍然返回 `8080`（持久化成功）
- [ ] `config list` → 显示所有配置，包括未设置但存在默认值的项

### 思考题

1. 如果两个进程同时 `config set port 8080` 和 `config set port 9090`，会有什么问题？怎么解决？
2. 如果每秒调用 10000 次 `config get`，每次读数据库会有什么性能问题？应该怎么优化？
3. `config list` 中，怎么区分"用户主动设置的"和"使用默认值的"配置项？

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/src/components/timer/SessionConfig.tsx` | 添加 useEffect 从数据库加载默认值 |
