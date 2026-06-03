# MoeFocus 项目经验总结

> 持续更新中 — 记录本项目中遇到的值得记住的设计决策、技术陷阱与解决方案。

## 数据库：为什么选 sql.js 而不是 better-sqlite3

**场景**：Electron 桌面应用需要本地数据库存储日程数据。

**教训**：在 Node.js 版本非常新（如 v26）的 Windows 环境下，带原生编译的 npm 包（如 better-sqlite3）容易出现 V8 API 不兼容问题。

**方案**：sql.js (SQLite WebAssembly 实现) 是更稳健的选择。它牺牲了一点性能（数据库操作在 WASM 而非原生 C），但获得了零编译问题和完全的跨平台兼容性。对于不需要高并发的本地桌面应用，这点性能差异可以忽略。

**关键代码模式**：
```typescript
// sql.js 需要手动持久化（这一点不同于 better-sqlite3）
db.run('INSERT INTO ... VALUES (?, ?)', [a, b])
save()  // 必须显式调用以写入磁盘

// 获取自增 ID
const row = db.get('SELECT last_insert_rowid() as id')
```

## Electron 无边框窗口

- `frame: false` 在 `BrowserWindow` 选项中
- CSS 中使用 `-webkit-app-region: drag` 让自定义标题栏可拖拽
- 窗口控制按钮区域需要 `-webkit-app-region: no-drag` 否则无法接收点击

## CSS Modules in TypeScript

需要声明 `.module.css` 的类型：
```typescript
declare module '*.module.css' {
  const classes: { [key: string]: string }
  export default classes
}
```

## IPC 设计原则

- 所有主进程能力通过 preload.ts 的 contextBridge 暴露
- 渲染进程不导入任何 electron 或 node 模块
- IPC 通道命名采用 `domain:action` 格式（如 `task:getAll`, `focus:start`）
- 事件推送（主→渲染）带 `on_` 前缀的注册方法 + 返回 cleanup 函数

## @dnd-kit 拖拽系统最佳实践

- DndContext 要包裹所有参与拖拽的组件（拖源 + 放区）
- 用 `data` 属性区分来源：`data: { type: 'library', task }` vs `data: { type: 'todo', item }`
- 在 onDragEnd 中根据 `active.data.current.type` 决定行为
- DragOverlay 提供拖拽时的浮动预览，提升 UX
- SortableContext 的 items 必须是字符串 ID 数组

## 计时器实现：渲染进程 vs 主进程

选择在渲染进程用 setInterval：
- 优势：实现简单，直接操作 React 状态
- 劣势：浏览器标签页切换后可能被节流
- 对于桌面应用的 Electron 渲染进程，不会出现此问题（不是浏览器标签页）
- 若需要绝对精确的计时，应放在主进程用 `powerMonitor` 处理休眠

## 萌系 UI 设计要点

- 大圆角 (16px+) 是萌系 UI 的灵魂
- 粉色系为主色调，辅以薰衣草紫和薄荷绿
- 阴影使用主色调的半透明色（而非纯灰色）
- 圆体字体（M PLUS Rounded 1c）天然适合萌系风格
- canvas 樱花粒子用 requestAnimationFrame，控制在 20 个以内保证性能

## GitHub CI/CD for Electron

- 用 `softprops/action-gh-release@v2` 自动发布到 Releases
- 触发器：`push tags v*.*.*`
- Node 版本固定用 v20 LTS（避免 v26 的兼容性问题）
- Windows runner 默认有 Visual Studio，可以编译原生模块

## 数据流误区：统计读什么？JSON 还是数据库？

**常见误解**：统计图表的数据来源是 `data/focus_sessions.json` 或 `sums/*.md` 日记文件。

**实际情况**：统计数据**直接查询本地 SQLite `focus_sessions` 表**，与 JSON 文件和日记文件无关。

三种数据的角色完全不同：

| 数据 | 存储位置 | 角色 | 谁读它 |
|------|----------|------|--------|
| `focus_sessions` 表 | 本地 SQLite (`moefocus.db`) | **唯一数据源 (source of truth)** | 统计图表、日记生成、导出 |
| `data/focus_sessions.json` | GitHub 私有仓库 | **同步传输载体** | `SyncService` 导出/合并/导入 |
| `sums/YYYY-MM-DD.md` | GitHub 私有仓库 + 本地 | **给人看的派生输出** | 用户在 Typora 中阅读/编辑 |

数据流向：

```
专注会话完成 → INSERT INTO focus_sessions (SQLite)
                    │
                    ├── 统计图表: SELECT ... FROM focus_sessions (直接查DB)
                    │
                    ├── 同步: SELECT → JSON → git push → 另一台PC → git fetch → JSON → INSERT OR IGNORE (UUID去重)
                    │
                    └── 日记: SELECT → DiaryService.generate() → sums/*.md (派生，统计从不读它)
```

**为什么容易搞混**：因为 `sums/*.md` 日记文件和 `data/*.json` 都在 GitHub 仓库里可见，而 SQLite 数据库是本地 `.gitignore` 排除的不可见文件。从 Git 仓库的角度看似乎数据都在 JSON 和 MD 里，但实际上是反过来——JSON 和 MD 都是从 SQLite **导出**的。

**教训**：区分 source of truth（SQLite）、传输格式（JSON）、展示格式（MD）。统计模块永远直接查数据库，不经过任何中间文件。
