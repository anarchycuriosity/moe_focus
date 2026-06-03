# 01 - MoeFocus 架构设计文档

## 项目缘起

需要一个类似 Windows 专注钟的日程管理桌面应用，但需要更多自定义功能：拖拽式 TODO、自动日记生成与 GitHub 归档、QQ 邮箱提醒、萌系视觉风格。市面上没有现成工具满足这些需求，因此决定从零构建。

## 技术决策

### 为什么选 Electron + React？

| 候选方案 | 优势 | 劣势 |
|----------|------|------|
| Electron + React | HTML/CSS 实现萌系 UI 最灵活；@dnd-kit 拖拽方案成熟；recharts 图表丰富 | 包体积较大 (~150MB) |
| Python + PySide6 | 原生 Windows 体验好 | 萌系 UI 定制困难，需要 QSS/QML |
| Tauri + React | 比 Electron 轻量得多 | 生态不够成熟；Rust 后端增加开发复杂度 |

**决定**: Electron + React。对于桌面日程管理类应用，包体积不是核心考量，UI 表现力才是。且 Electron 生态对文件系统、系统通知、子进程管理等需求支持最好。

### 状态管理：为什么选 Zustand 而非 Redux？

- Zustand 无模板代码，API 极简，适合中小型应用
- 不需要 Provider 包裹，减少组件层级
- 支持 subscribe 和 middleware，满足所有需求
- Redux Toolkit 对这类项目过度设计

### 数据库：为什么选 better-sqlite3？

- SQLite 文件级部署，零配置
- better-sqlite3 同步 API，在 Electron 主进程中天然适合
- 不需要额外的数据库服务进程·
- 比 electron-store 更适合结构化查询（统计需要复杂的 GROUP BY）

## 架构总览

```
┌─────────────────────────────────────────────┐
│                  Electron                    │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Main Process │  │   Renderer Process   │ │
│  │               │  │   (React App)        │ │
│  │  Services:    │  │                      │ │
│  │  - Database   │◄─┤  IPC (contextBridge) │ │
│  │  - FocusTimer │  │                      │ │
│  │  - Diary      │  │  Pages:              │ │
│  │  - Git        │  │  / TodayPage         │ │
│  │  - Email      │  │  /focus FocusPage    │ │
│  │  - Scheduler  │  │  /diary DiaryPage    │ │
│  │  - Typora     │  │  /statistics Stats   │ │
│  │               │  │  /settings Settings  │ │
│  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 核心设计原则

1. **渲染进程不碰 Node.js API**：所有系统调用通过 preload.ts 暴露的 IPC 通道
2. **计时器跑在主进程**：防止渲染进程重渲染导致的计时偏差
3. **定时任务用 node-cron**：优雅的 cron 表达式，绑定应用生命周期
4. **所有持久化走 SQLite**：包括用户设置，不使用 electron-store（减少依赖，统一数据层）

## 数据流

```
用户操作 → React Component → Zustand Store → IPC invoke → Main Handler → Service → SQLite
                                                                              ↓
用户看到 ← React 重渲染 ← Zustand 更新 ← IPC event ← Main emits event ← Service 回调
```

## 文件组织哲学

- `electron/` 和 `src/` 物理隔离：主进程和渲染进程代码不能互相 import
- `components/` 按功能领域分组（tasks/, timer/, diary/...），而非按类型（atoms/, molecules/...）
- 公共 UI 组件放在 `common/`
- 页面组件放在 `pages/`，业务组件放在 `components/`
- 每个 `.tsx` 组件配一个 `.module.css`（CSS Modules 避免样式污染）

## 萌系视觉设计系统

### 色彩调色板

```
--moe-pink: #FFB7C5       (主色调，樱花粉)
--moe-pink-dark: #E892A3  (深粉，hover 状态)
--moe-lavender: #C9A9DC   (薰衣草紫，辅助色)
--moe-mint: #B5EAD7       (薄荷绿，成功/完成状态)
--moe-sky: #C7CEEA        (天蓝，信息提示)
--moe-cream: #FFF5EE      (奶油白，背景)
--moe-text: #5B4B59       (深紫灰，正文)
--moe-text-light: #8B7B89 (浅紫灰，注释)
```

### 圆角与阴影

- 圆角使用 `--moe-radius: 16px` 和 `--moe-radius-sm: 10px`
- 阴影使用粉色半透明：`--moe-shadow: rgba(255, 183, 197, 0.3)`
- 所有卡片、按钮、面板统一使用大圆角 + 柔和阴影

### 字体选择

"M PLUS Rounded 1c"：Google Fonts 提供的日文兼容圆体字，天然带有萌系气质
