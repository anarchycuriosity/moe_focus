# 🌸 MoeFocus

日系萌系风格的桌面日程管理应用，灵感来自 Windows 专注钟。

## 快速开始

### 方式一：下载安装程序（推荐）

从 [Releases](https://github.com/anarchycuriosity/moe_focus/releases) 页面下载最新版 `MoeFocus Setup x.x.x.exe`，双击安装即可。

安装完成后桌面会有 MoeFocus 快捷方式，打开即用。无需安装 Node.js 或任何额外环境。

### 方式二：从源码启动（开发者）

```bash
cd moefocus
npm install
npm run dev
```

或直接双击 `moefocus/start-dev.bat`，脚本会自动安装依赖并启动。

> **注意**：项目在 Windows 环境下开发。WSL 中运行可能出现路径问题。

### 启动后

- **今日**页面：左侧任务库拖拽到今日计划 → 设置专注事项 → 点击「开始专注」
- **日记**页面：每日自动生成，记录专注数据与反思
- **统计**页面：查看周/月专注时间分布
- **设置**页面：配置同步、邮箱提醒、壁纸等

不需要额外安装数据库 —— SQLite 内嵌在应用中。

## 功能

- **拖拽 TODO**：从预设任务库拖拽项目到今日计划
- **专注计时**：可配置专注时长的番茄钟，专注完成自动记录
- **自动日记**：每日自动生成日记总结，汇总专注数据
- **统计图表**：按周/月查看专注时间堆叠分布，每个事项用不同颜色区分
- **GitHub 同步**：双 PC 间通过 GitHub 私有仓库同步数据
- **QQ 邮箱提醒**：定时提醒完成日记自我反思
- **萌系视觉**：毛玻璃 UI 面板方便看到壁纸、樱花飘落特效、自定义壁纸

## 目录结构

```
├── moefocus/                # 桌面端 (Electron + React)
│   ├── electron/            # Electron 主进程 (Node.js)
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
│   ├── resources/           # 打包资源 (图标等)
│   ├── package.json
│   ├── electron.vite.config.ts
│   └── electron-builder.yml
├── moefocus-mobile/         # 移动端 (React Native + Expo)
│   ├── App.tsx
│   ├── src/screens/         # Today/Focus/Stats/Settings
│   ├── src/store/           # Zustand stores
│   ├── src/services/        # expo-sqlite database
│   └── src/styles/          # Moe theme
└── review/                  # 学习文档 (架构/阶段记录/数据管理)
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
| `focus_sessions` | 专注会话记录（每次专注完成后记录实际时长和事项）|
| `diary_entries` | 日记条目 |
| `settings` | 应用设置 (键值对) |
| `wallpapers` | 自定义壁纸记录 |

### 日记文件

每日生成的 Markdown 日记存储在：
```
%APPDATA%/moefocus/sums/YYYY-MM-DD.md
```

### 自定义壁纸

在应用「设置 → 通用 → 自定义壁纸」中选择本地图片作为全局背景和日记页大图。

- 支持格式：jpg / jpeg / png / gif / webp / bmp
- 壁纸选中后立即生效，作为全局背景和日记页展示
- GUI 面板采用毛玻璃效果，方便欣赏壁纸
- 壁纸路径记录在数据库中，重启应用后自动恢复

选择壁纸后路径存储在：
```
%APPDATA%/moefocus/moefocus.db (wallpapers 表)
```

### 日记相框图片

日记页支持从 `moefocus/diary-pictures/` 目录自动加载图片并轮播展示。

- 图片文件名**必须使用英文**命名（如 `photo.png`），中文文件名会导致路径识别失败
- 轮播间隔和开关可在「设置 → 通用 → 日记相框」中调整
- 支持格式：jpg / png / gif / webp / bmp

## 双 PC 数据同步

### 需要额外仓库吗？

**是的。** 多设备同步需要一个独立的 GitHub 私有仓库来存储数据。这个数据仓库与你手中的 MoeFocus 代码仓库是两个不同的仓库：

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  本仓库 (MoeFocus 源码)  │     │  数据仓库 (你的私有仓库)     │
│  github.com/xxx/moefocus │     │  github.com/you/moefocus-data │
├─────────────────────────┤     ├──────────────────────────┤
│  React/Electron 代码     │     │  sums/  日记 Markdown     │
│  CSS / 组件              │     │  data/  JSON 数据导出      │
│  构建配置                │     │  .gitignore (排除 *.db)    │
└─────────────────────────┘     └──────────────────────────┘
  git clone 到 PC    →→→    GitHub 同步 ←→  PC ② git pull/push
```

**为什么这样设计？**

- 源码仓库（本仓库）：体积大（含 node_modules、Electron 二进制），不适合存储用户数据。开发者推送新功能时不应混入你的个人日记。
- 数据仓库：仅包含日记和 JSON 数据文件（几十 KB），同步速度快。你拥有完全控制权（设为私有）。

### 同步机制

每条专注会话分配全局唯一 UUID，导出为 `data/focus_sessions.json`。同步时：

1. `export`：本地所有会话导出为 JSON（UUID → 会话数据）
2. `git fetch` + `git show`：逐文件读取远程内容（不修改本地工作区）
3. `merge`：日记 `.md` 语义合并（时间累加 + 事项合并）+ JSON UUID 取并集
4. `commit + push`：推送合并结果
5. `import`：`INSERT OR IGNORE` 新 UUID 的会话到本地数据库
6. `rebuild`：自动更新日记条目表，界面实时反映合并后数据

实际同步的文件：
- `sums/`：日记 Markdown 文件（`YYYY-MM-DD.md`）
- `data/`：`focus_sessions.json`（UUID 索引的会话数据）

### 配置步骤

1. 在 GitHub 创建一个**空的私有仓库**（例如 `moefocus-data`），**不要**勾选任何初始化选项
2. 打开 MoeFocus → 设置 → GitHub 标签页
3. 输入仓库地址（如 `https://github.com/你的用户名/moefocus-data.git`）→ 点击「应用远程地址」
4. 点击「一键同步」即可拉取/推送数据
5. 确保系统已配置 Git 凭证管理器（否则推送时可能要求登录）：
   ```
   git config --global credential.helper manager
   ```
6. 在另一台电脑上安装 MoeFocus，重复步骤 2-4

### 两台电脑的数据流向

```
PC ①                         GitHub 私有仓库                    PC ②
─────                        ──────────────                    ─────
记录专注 → UUID导出                                           记录专注 → UUID导出
    │                              │                               │
    └── 一键同步 ──→  合并+推送  ──→  一键同步 ──→ 导入+重建日记
                                                        │
                            ←── 合并+推送 ←── 一键同步 ──┘
```

### 同步内容

- 专注会话记录（通过 UUID JSON 导入，统计图表反映所有 PC 数据）
- 日记 Markdown（语义合并：时间累加、事项合并、反思保留本地）
- 日记条目表（自动从合并后的 `sums/*.md` 重建）

### 不同步内容

- 自定义壁纸文件（每台电脑独立管理）
- SQLite 原始数据库 `*.db`（通过 `.gitignore` 排除，转为 JSON 同步）
- 任务库和 TODO（待后续版本支持）

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
cd moefocus

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
