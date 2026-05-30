# 🌸 MoeFocus

日系萌系风格的桌面日程管理应用，灵感来自 Windows 专注钟。

## 功能

- **拖拽 TODO**：从预设任务库拖拽项目到今日计划
- **专注计时**：可配置专注/休息时长的番茄钟
- **自动日记**：每日自动生成日记总结，汇总专注数据
- **统计图表**：按周/月查看专注时间分布
- **GitHub 同步**：双 PC 间通过 GitHub 私有仓库同步数据
- **QQ 邮箱提醒**：定时提醒完成日记自我反思
- **萌系视觉**：可自定义壁纸，樱花飘落特效，相框装饰

## 目录结构

```
moefocus/
├── electron/                # Electron 主进程 (Node.js)
│   ├── main.ts              # 应用入口，窗口创建
│   ├── preload.ts           # 安全桥接层，暴露 API 给渲染进程
│   ├── ipc/                 # IPC 通信处理器
│   │   └── index.ts         # 所有主进程 API 的实现
│   ├── services/            # 业务逻辑服务
│   │   ├── DatabaseService.ts   # 数据库封装 (sql.js)
│   │   ├── DiaryService.ts      # 日记生成 (Markdown)
│   │   ├── FocusTimerService.ts # 计时器状态机
│   │   ├── GitService.ts        # Git 操作 (simple-git)
│   │   ├── EmailService.ts      # QQ 邮件 (nodemailer)
│   │   ├── SchedulerService.ts  # 定时任务 (node-cron)
│   │   └── TyporaService.ts     # Typora 启动器
│   └── database/
│       └── schema.sql       # 数据库表结构定义
├── src/                     # React 渲染进程 (UI)
│   ├── main.tsx             # React 入口
│   ├── App.tsx              # 根组件
│   ├── routes.tsx           # 路由配置
│   ├── components/          # UI 组件
│   │   ├── layout/          # 布局组件 (标题栏/侧边栏/背景)
│   │   ├── tasks/           # 任务与 TODO 组件
│   │   ├── timer/           # 专注计时器组件
│   │   ├── diary/           # 日记组件
│   │   ├── stats/           # 统计图表组件
│   │   ├── settings/        # 设置面板组件
│   │   ├── widgets/         # 装饰组件 (樱花/相框)
│   │   └── common/          # 通用 UI 组件
│   ├── pages/               # 页面组件
│   ├── store/               # Zustand 状态管理
│   ├── hooks/               # 自定义 React Hook
│   ├── styles/              # 全局样式与主题
│   ├── types/               # TypeScript 类型声明
│   └── assets/              # 静态资源 (壁纸/字体/图标)
├── sums/                    # 日记输出目录 (Markdown 文件)
├── data/                    # 数据同步目录 (JSON 导出，用于 PC 间同步)
├── resources/               # 打包资源 (图标等)
├── package.json             # 项目依赖与脚本
├── electron.vite.config.ts  # 构建配置
└── electron-builder.yml     # 打包配置
```

## 数据存储

### 本地数据

所有应用数据存储在 SQLite 数据库中，位于：
```
%APPDATA%/moefocus/moefocus.db
```

包含以下数据表：
| 表名 | 内容 |
|------|------|
| `tasks` | 预设任务库 |
| `todo_items` | 每日 TODO 列表 |
| `focus_sessions` | 专注会话记录 |
| `diary_entries` | 日记条目 |
| `settings` | 应用设置 (键值对) |
| `wallpapers` | 自定义壁纸记录 |

### 日记文件

每日生成的 Markdown 日记存储在：
```
%APPDATA%/moefocus/sums/YYYY-MM-DD.md
```

### 自定义壁纸

拖入的背景图片存储在：
```
%APPDATA%/moefocus/wallpapers/
```

## 双 PC 数据同步

通过 GitHub 私有仓库实现两台电脑间的数据同步。

### 同步机制

1. 数据以 JSON 格式导出到 `data/` 目录
2. 应用关闭时自动 `git commit` + `git push`
3. 应用启动时自动 `git pull`，检测到新数据则导入

### 仓库地址

| 用途 | 地址 |
|------|------|
| 源代码 | https://github.com/anarchycuriosity/moe_focus |
| 数据同步 | https://github.com/anarchycuriosity/moe_focus_data |

### 配置步骤

1. 数据仓库已预填在应用设置中（GitHub 标签页）
2. 确保系统已配置 Git 凭证管理器：
   ```
   git config --global credential.helper manager
   ```
3. 在两台电脑上使用相同的 GitHub 账号

### 同步内容

- 预设任务库
- 专注会话记录
- TODO 完成状态
- 日记反思内容
- 应用设置

### 不同步内容

- 自定义壁纸文件（每台电脑独立管理）
- 日记 Markdown 文件（通过 `sums/` 目录直接 Git 同步）

## 开发

### 环境要求

- Node.js (推荐 v20 LTS)
- npm
- Windows PowerShell（不要在 WSL 中运行）

### 国内网络环境安装

项目已配置淘宝镜像（`.npmrc`），但 Electron 二进制文件需要额外设置。

**方法一：一键脚本**

在项目目录右键 → "使用 PowerShell 运行" `setup.ps1`

**方法二：手动设置**

打开 PowerShell，逐行执行：

```powershell
cd C:\Users\curiosity\claude_pros\daily\moefocus

# 设置 Electron 下载镜像
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

# 安装依赖
npm install
```

> `.npmrc` 已将 npm 包下载指向 `registry.npmmirror.com`。
> Electron 二进制文件需通过环境变量 `ELECTRON_MIRROR` 指定镜像，因为它不走 npm registry。

### 启动开发服务器

```bash
cd moefocus
npm install
npm run dev
```

### 构建

```bash
npm run build
```

### 打包为安装程序

```bash
npm run package
```
安装包输出在 `dist/` 目录。

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 28 |
| 前端 | React 18 + TypeScript |
| 构建 | electron-vite |
| 状态管理 | Zustand |
| 拖拽 | @dnd-kit |
| 图表 | recharts |
| 数据库 | sql.js (SQLite WASM) |
| 邮件 | nodemailer |
| Git | simple-git |

## 许可

MIT License
