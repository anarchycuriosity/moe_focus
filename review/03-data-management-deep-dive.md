# 03 - 数据管理深度解析 (后端视角)

> 面向有 C++ 基础、初次接触全栈桌面应用的学习者。
> 重点讲解：数据库设计思路、IPC 通信机制、状态管理、数据在系统各层级间的流动。

---

## 一、核心问题：数据放在哪里，怎么流转？

一个桌面应用本质上是一个 **单机版的客户端-服务器模型**。这里有几个关键的数据层次：

```
┌─────────────────────────────────────────────────────┐
│  渲染进程 (React)          │  主进程 (Node.js)       │
│                            │                         │
│  Zustand Store (内存)      │  DatabaseService        │
│       ↕                    │       ↓                 │
│  React Component (视图)    │  sql.js (WASM SQLite)   │
│       ↕                    │       ↓                 │
│  electronAPI (IPC 调用)───→│  disk: moefocus.db     │
└─────────────────────────────────────────────────────┘
```

对应后端开发的类比：

| MoeFocus | 后端服务器 |
|----------|-----------|
| 渲染进程 React | 前端浏览器 |
| 主进程 Node.js | 后端服务器 |
| IPC (contextBridge) | REST API / gRPC |
| sql.js + SQLite | PostgreSQL / MySQL |
| Zustand Store | 客户端缓存 |

---

## 二、数据库设计：从需求到表结构

### 2.1 设计思路

数据库设计的核心原则：**一切从查询需求出发**。

先列出我们需要回答的问题：
1. "今天有哪些待办事项？" → 查 todo_items 表，按 date 过滤
2. "今天专注了多久？" → 查 focus_sessions 表，SUM(actual_duration_sec)，按 date 聚合
3. "本周每天各专注了多少分钟？" → GROUP BY date，按周范围
4. "专注时间都花在哪些任务上？" → JOIN focus_sessions + todo_items + tasks

然后反向设计表结构。

### 2.2 表结构解读

```sql
-- 预设任务库：用户可以预先定义常做的任务类型
CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,          -- 任务名称
  category      TEXT DEFAULT 'General', -- 分类标签
  color         TEXT DEFAULT '#FFB7C5', -- UI颜色标记
  sort_order    INTEGER DEFAULT 0,     -- 手动排序
  is_active     INTEGER DEFAULT 1      -- 软删除标记
);

-- 每日TODO：从任务库拖入今日计划的实例
CREATE TABLE todo_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       INTEGER REFERENCES tasks(id) ON DELETE SET NULL, -- 外键：关联源任务
  custom_title  TEXT,                   -- 可覆盖任务名称
  date          TEXT NOT NULL,          -- 所属日期 YYYY-MM-DD
  status        TEXT DEFAULT 'pending', -- pending | done | cancelled
  sort_order    INTEGER DEFAULT 0       -- 拖拽排序
);

-- 专注会话：每次专注计时的记录
CREATE TABLE focus_sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id             INTEGER REFERENCES todo_items(id) ON DELETE SET NULL,
  subject             TEXT,             -- 专注主题
  planned_duration_min INTEGER NOT NULL, -- 计划时长（分钟）
  actual_duration_sec INTEGER DEFAULT 0, -- 实际时长（秒）← 统计依赖此字段
  status              TEXT DEFAULT 'running', -- running|paused|completed|abandoned
  date                TEXT NOT NULL     -- 所属日期
);

-- 日记条目
CREATE TABLE diary_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL UNIQUE, -- 每天一篇
  summary_text    TEXT,                 -- 自动生成内容
  reflection_text TEXT,                 -- 用户写的反思
  git_committed   INTEGER DEFAULT 0,   -- 是否已 commit
  git_pushed      INTEGER DEFAULT 0    -- 是否已 push
);

-- 设置：键值对存储（灵活的配置系统）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,               -- 如 'focus.defaultDuration'
  value TEXT NOT NULL                   -- JSON 或纯文本值
);
```

### 2.3 为什么用键值对存储设置？

两种方案对比：

```sql
-- 方案 A：宽表（不推荐）
CREATE TABLE settings (
  focus_duration INT,
  rest_duration INT,
  diary_time TEXT,
  email_user TEXT,
  email_pass TEXT,
  github_url TEXT,
  ...
  -- 每次加新设置都要 ALTER TABLE
);

-- 方案 B：键值对（推荐 ✅）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- INSERT INTO settings VALUES ('focus.defaultDuration', '25');
-- INSERT INTO settings VALUES ('email.qqUser', 'user@qq.com');
```

键值对的优势：
- **扩展性**：加新设置 = INSERT 一行，无需修改表结构
- **简洁**：不需要维护几十个 NULL 列
- **灵活**：value 可以是任何格式（数字、字符串、JSON）

### 2.4 统计查询：数据如何变成图表

看一个典型的统计查询：

```sql
-- "本周每天各专注了多少分钟？"
SELECT date,
       SUM(actual_duration_sec) / 60 AS total_minutes
FROM focus_sessions
WHERE date >= '2026-05-25'
  AND date < '2026-06-01'
  AND status = 'completed'          -- 只看完成的会话
GROUP BY date
ORDER BY date;
```

这对应后端中的 **聚合查询 + 分组** 模式。GROUP BY 在这里充当了「按天分组」的角色。

更复杂的例子——按月+按周分组：

```sql
SELECT
  date,
  -- 计算是当月第几周
  CAST(strftime('%W', date) AS INTEGER)
    - CAST(strftime('%W', '2026-05-01') AS INTEGER) + 1 AS week_of_month,
  SUM(actual_duration_sec) AS total_seconds
FROM focus_sessions
WHERE strftime('%Y-%m', date) = '2026-05'
GROUP BY date;
```

这里的 `strftime` 是 SQLite 内置的日期函数，相当于后端中常用的 `date_trunc` 或 `DATE_FORMAT`。

---

## 三、IPC 通信：渲染进程如何「调用」主进程

### 3.1 为什么不能直接调用？

Electron 的安全模型规定：
- **渲染进程**：运行在沙盒中，不能访问 Node.js API、文件系统、数据库
- **主进程**：拥有完整的 Node.js 能力

所以，渲染进程要操作数据库，必须经过中间层。

### 3.2 contextBridge：安全的桥梁

```
渲染进程                    主进程
┌──────────┐              ┌──────────┐
│ React 组件 │──IPC invoke──→│  IPC Handler │
│           │              │     ↓       │
│  electronAPI.todos.add() │  DatabaseService.run(sql) │
│           │←──返回结果───│              │
└──────────┘              └──────────┘
```

preload.ts 中的声明（类比：定义 API 接口）：

```typescript
// 这相当于 Swagger 定义的 API endpoint
contextBridge.exposeInMainWorld('electronAPI', {
  todos: {
    // 相当于 POST /api/todos
    add: (item) => ipcRenderer.invoke('todo:add', item),
    // 相当于 GET /api/todos?date=xxx
    get_by_date: (date) => ipcRenderer.invoke('todo:getByDate', date),
    // 相当于 DELETE /api/todos/:id
    remove: (id) => ipcRenderer.invoke('todo:remove', id),
  }
})
```

主进程中的 handler（类比：Controller 层）：

```typescript
// 相当于 Express 中的 router.post('/todo:add', handler)
ipcMain.handle('todo:add', (_event, item) => {
  // 1. 计算排序位置
  const max = db().get('SELECT MAX(sort_order) FROM todo_items WHERE date = ?', [item.date])
  // 2. 插入数据
  db().run('INSERT INTO todo_items (...) VALUES (?, ?, ?, ?)', [...])
  // 3. 获取自增 ID
  const id = db().get('SELECT last_insert_rowid() as id')
  // 4. 返回新创建的记录
  return db().get('SELECT * FROM todo_items WHERE id = ?', [id])
})
```

### 3.3 事件推送 vs 请求-响应

IPC 有两种通信模式：

**请求-响应** (类比 HTTP REST API)：
```typescript
// 渲染进程发送请求，等待响应
const task = await window.electronAPI.tasks.get_all()
```

**事件推送** (类比 WebSocket / Server-Sent Events)：
```typescript
// 主进程每秒推送计时器倒计时
mainWindow.webContents.send('focus:tick', remainingSeconds)

// 渲染进程注册监听器
window.electronAPI.focus.on_tick((remaining) => {
  updateProgressCircle(remaining)
})
```

---

## 四、状态管理：Zustand 如何工作

### 4.1 为什么需要状态管理？

在 React 中，数据有两种形式：
- **组件内部状态** (useState)：只有一个组件需要的数据
- **共享状态** (Store)：多个组件都要读写的同一份数据

例如：「今天的 TODO 列表」被 TodayPanel、TaskLibrary、FocusTimer 三个组件同时使用。如果用 useState 层层传递 props 会很复杂（这叫 prop drilling）。

### 4.2 Zustand 原理

```typescript
// 定义一个 Store
const useTodoStore = create((set, get) => ({
  items: [],                      // 状态数据
  loading: false,

  load_todos: async (date) => {   // 异步操作
    set({ loading: true })        // 设置 loading = true
    const items = await window.electronAPI.todos.get_by_date(date)
    set({ items, loading: false }) // 更新数据，触发重渲染
  },

  add_todo: async (task_id) => {
    const item = await window.electronAPI.todos.add({ task_id, date: get().date })
    set({ items: [...get().items, item] })  // 追加新项
  }
}))
```

在其他组件中使用：
```typescript
function TodayPanel() {
  const items = useTodoStore(state => state.items)   // 只读取 items
  const add_todo = useTodoStore(state => state.add_todo) // 只读取方法

  // items 变化时，组件自动重渲染
}
```

本质上是 **发布-订阅模式**：
1. `set()` 更新数据 → 通知所有订阅了该数据的组件
2. 组件收到通知 → React 重渲染 → 新数据反映到 UI

### 4.3 完整数据流追踪

以「拖拽任务到今日 TODO」为例：

```
步骤 1: 用户拖拽 TaskCard 到 TodayPanel
        ↓
步骤 2: @dnd-kit 触发 onDragEnd 事件
        ↓
步骤 3: TodayPage 调用 useTodoStore.add_todo(task.id)
        ↓
步骤 4: add_todo 异步调用 window.electronAPI.todos.add(...)
        ↓
步骤 5: IPC → 主进程 → todo:add handler
        ↓
步骤 6: handler 执行 SQL INSERT → sql.js → SQLite (内存)
        ↓
步骤 7: DatabaseService.save() → writeFileSync → disk (持久化)
        ↓
步骤 8: handler 返回新记录 → IPC 响应
        ↓
步骤 9: add_todo 调用 set({ items: [...old, newItem] })
        ↓
步骤 10: Zustand 通知订阅者 → TodayPanel 重渲染 → 新项出现在列表中
```

---

## 五、sql.js 的特殊性：内存数据库 + 手动持久化

### 5.1 与 better-sqlite3 的关键区别

| 特性 | better-sqlite3 | sql.js |
|------|---------------|--------|
| 运行位置 | 原生 C++ (V8 绑定) | WebAssembly (沙盒) |
| 存储位置 | 直接读写磁盘文件 | **存于内存，需手动 save()** |
| 编译 | 需要 node-gyp 编译原生模块 | 不需要编译，纯 JS/WASM |
| 性能 | 快 (原生) | 稍慢 (WASM 层)，本地应用感知不到 |

### 5.2 save() 的作用

```typescript
// better-sqlite3: 自动持久化
db.run('INSERT INTO tasks ...')  // 直接写入磁盘

// sql.js: 手动持久化
db.run('INSERT INTO tasks ...')  // 只在内存中
db.export()                       // 序列化为 Uint8Array
fs.writeFileSync(path, buffer)    // 写入磁盘
```

这类似于 **write-back cache**：所有操作先在内存中完成（快），然后整块写入磁盘。缺点是如果程序崩溃，未 save() 的数据会丢失——所以每次 run() 后立即 save()。

---

## 六、数据同步：Git + UUID 去重的分布式存储

### 6.1 核心思路

传统后端的数据同步靠中心化数据库：
```
客户端A → 服务器(PostgreSQL) ← 客户端B
```

MoeFocus 不需要服务器，利用 GitHub 仓库作为「数据中转站」：
```
PC-A → git push → GitHub Repo → git fetch + merge → PC-B
```

但简单的 git pull/push 有严重问题：两台 PC 独立生成同一天的日记后 push，会产生合并冲突（merge conflict），且冲突发生在机器生成的 Markdown 文件中，手动解决极其痛苦。

所以 MoeFocus 的同步策略是：**源数据（JSON）用 UUID 去重合并，派生数据（日记 MD）从数据库重新生成**。

### 6.2 同步的数据类型

同步涉及两类数据，处理方式截然不同：

**A. 源数据 — focus_sessions.json (UUID 去重合并)**

每条专注会话有全局唯一的 UUID (`crypto.randomUUID()`)。JSON 格式是以 UUID 为 key 的字典，而非数组：

```json
// data/focus_sessions.json
{
  "a1b2c3d4-...": { "subject": "学日语", "date": "2026-05-30", "actual_duration_sec": 1500, ... },
  "e5f6g7h8-...": { "subject": "写代码", "date": "2026-05-30", "actual_duration_sec": 3600, ... }
}
```

合并时使用 `{ ...remote_json, ...local_json }` 的浅合并 —— 同 UUID 以本地为准，新 UUID 自动追加。这样无论两台 PC 各自生成了多少会话，合并后都是完整的并集。

**B. 派生数据 — sums/*.md (从数据库重新生成)**

日记 Markdown 文件是从 `focus_sessions` 表 **派生** 的输出，不是源数据。因此同步流程中：
- 导入远程会话到 SQLite → 调用 `DiaryService.generate()` 逐日重新生成日记
- **不对 MD 文件做文本合并** —— 之前尝试的语义合并（累加时间、合并事项）会导致重复同步时数据翻倍

### 6.3 完整同步流程

```
┌─ 1. export ───────────────────────────────────────────────────┐
│  DatabaseService 查询所有 completed 会话                        │
│  → 导出为 data/focus_sessions.json (UUID → 会话 的映射)         │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌─ 2. fetch + reset ────────────────────────────────────────────┐
│  git fetch origin                                              │
│  → git reset --hard origin/main (将本地 git 历史对齐到远程 HEAD) │
│  → 本地数据已在内存快照中保护，reset 只清 git 历史不丢数据       │
│  → 之后 commit 基于远程 HEAD，push 是干净的 fast-forward        │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌─ 3. merge JSON ───────────────────────────────────────────────┐
│  读取远程 data/*.json → 与本地内存快照合并                      │
│  → focus_sessions.json: UUID 级别浅合并 (远程新UUID自动加入)    │
│  → 其他 JSON 文件同理                                          │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌─ 4. commit + push ────────────────────────────────────────────┐
│  git add data/ sums/ → git commit → git push origin main       │
│  → 此时 push 必然成功（reset 后本地基于远程 HEAD）              │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌─ 5. import ────────────────────────────────────────────────────┐
│  读取合并后的 data/focus_sessions.json                          │
│  → INSERT OR IGNORE 到本地 SQLite (已存在的 UUID 跳过)          │
│  → 返回导入的新会话数                                           │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌─ 6. regenerate ───────────────────────────────────────────────┐
│  SELECT DISTINCT date FROM focus_sessions WHERE completed      │
│  → 逐日调用 DiaryService.generate(date) 重新生成所有日记 MD     │
│  → 单日失败不影响其他日期 (try-catch 隔离)                      │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌─ 7. sync diary_entries ───────────────────────────────────────┐
│  遍历 sums/*.md → 写入/更新 diary_entries 表                    │
│  → 确保日记页查询 diary_entries 表时能看到同步后的数据          │
└────────────────────────────────────────────────────────────────┘
```

### 6.4 为什么不用简单的 git pull/push？

| 问题 | 根因 | 解决方案 |
|------|------|----------|
| 合并冲突 | 两台 PC 独立生成同天日记 → pull 时冲突 | JSON UUID 去重 → regenerate MD |
| push 被拒 | 本地 commit 与远程形成分叉历史 | `git reset --hard origin/main` 后再 commit |
| 数据翻倍 | MD 语义合并做加法，重复同步累加 | 不再合并 MD，改为从 DB 重新生成 |
| 同步静默失败 | checkout -B 遇脏文件失败，catch 空吞错 | `git reset --hard` 替代 `checkout -B` |
| 统计不同步 | focus_sessions 表被 .gitignore 排除 | 导出 JSON → 同步 JSON → 导入 JSON |
| 日记不同步 | diary_entries 表查数据库不读文件 | `sync_diary_entries_from_files()` 补充 |
| 仓库初始化错误 | `checkIsRepo()` 向上递归到用户主目录 | `existsSync(.git)` 精确检测 |

### 6.5 同步入口

同步有三层入口，用户可在任意一层触发：

1. **侧边栏 🔄 按钮**：GUI 一键同步，tooltip 显示诊断信息（远程日记数 / 新会话数 / 同步天数）
2. **统计页同步按钮**：同步 + 清理孤儿数据 + 刷新图表
3. **DevTools Console**：`window.__moe_sync__()` 可在 GUI 外直接调用测试
4. **启动自动同步**：`main.ts` 启动时自动执行完整同步链路

### 6.6 安全防护

- **syncCleanup 双重防护**：diary_entries 为空时跳过删除；孤儿会话占比超 50% 时跳过（疑数据库异常）
- **diary 再生异常隔离**：单日生成失败不影响其他日期
- **诊断字段**：SyncResult 包含 `remote_sums_count` / `remote_data_count` / `diary_entries_synced`，零数据时明确提示「远程无新内容」

---

## 关键要点总结

1. **数据库设计从查询出发**：先想好要回答什么问题，再设计表
2. **IPC 就是桌面应用的 REST API**：主进程是服务器，渲染进程是客户端
3. **Zustand = 客户端缓存 + 发布订阅**：集中管理共享数据，变更自动通知 UI
4. **sql.js 需要手动 save()**：和 better-sqlite3 的最大区别
5. **Git 同步 ≠ 简单的 pull/push**：UUID 去重 + DB regenerate 才是正确的多 PC 同步方案
6. **源数据和派生数据要区分处理**：JSON 做 UUID 去重合并，MD 从 DB 重新生成，切不可直接合并 MD
