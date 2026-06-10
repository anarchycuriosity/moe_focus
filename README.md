# 🌸 MoeFocus

日系萌系风格的桌面专注管理应用，灵感来自 Windows 专注钟。帮助你记录每日专注时间、自动生成日记总结，并通过 GitHub 在多台电脑间同步数据。

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

## 页面功能

### 📋 今日

左侧**预设任务库**中可创建常用任务（科目/事项），设置图标和颜色标签。拖拽任务到右侧**今日计划**即可安排当天的 TODO。

点击 TODO 旁的「开始专注」进入计时。支持暂停、恢复、提前完成和放弃。每次专注完成后自动记录会话数据（实际时长、事项名称）。

### ⏱️ 专注计时器

可配置专注时长和休息时长的番茄钟。计时过程中显示剩余时间，专注结束后自动记录到数据库，并在日记生成时汇总。

- 默认专注时长：25 分钟（可在设置中修改）
- 默认休息时长：5 分钟
- 每日专注目标：120 分钟（用于进度统计和邮件提醒的语气判断）

### 📔 日记

每天自动生成 Markdown 格式日记，保存在 `%APPDATA%/moefocus/sums/YYYY-MM-DD.md`。

日记内容包含：
- **📊 今日统计**：总专注时间、专注会话数（自动生成）
- **🎯 事项时间分布**：每个事项的专注时间明细（自动生成）
- **💭 自我反思**：用户手动撰写的反思区域

支持的日记操作：
- **生成日记**：选择日期，根据当日专注记录生成/更新日记统计区（不影响反思区内容）
- **用 Typora 打开**：在 Typora 中查看和编辑日记（需在设置中配置 Typora 路径）
- **清空自定义总结**：清空自我反思区域内容，写入同步删除标记，后续同步不会再拉回旧反思（统计区和专注数据不受影响）
- **删除日记**：删除整篇日记及相关数据库记录

### 📊 统计

按**周**或**月**查看专注时间分布：

- 堆叠柱状图：每个日期的柱子按事项用不同颜色分段堆叠
- 饼图（可在设置中切换）：展示各事项的专注时间占比
- 每个事项的颜色与任务库中设置的标签颜色一致

### 🎯 长期目标

管理长期任务和目标，支持设置截止日期。

- 按「进行中 / 已完成 / 全部」筛选
- 标记完成后自动归类，并记录完成时间
- 长期目标随 GitHub 同步在双 PC 间共享

### ⚙️ 设置

四个标签页，完整配置应用行为：

**通用**
| 设置项 | 说明 |
|--------|------|
| 主题 | 樱花粉 / 薰衣草紫 等配色方案 |
| 深色模式 | 切换深色/浅色主题 |
| 自定义壁纸 | 选择本地图片作为全局背景和日记大图（支持 jpg/png/gif/webp/bmp） |
| Typora 路径 | Typora 可执行文件路径，用于自动打开日记 |
| 日记自动生成时间 | 每天定时自动生成日记（默认 23:00） |
| 日记相框 | 从 `moefocus/diary-pictures/` 加载图片轮播展示，可调整轮播间隔和开关 |

**计时默认值**
| 设置项 | 说明 |
|--------|------|
| 默认专注时长 | 每次专注的默认分钟数（默认 25） |
| 默认休息时长 | 专注结束后休息的默认分钟数（默认 5） |
| 每日专注目标 | 每日目标专注分钟数（默认 120），用于进度判断 |

**邮箱**
| 设置项 | 说明 |
|--------|------|
| QQ 邮箱地址 | 发件 QQ 邮箱账号 |
| QQ 邮箱授权码 | SMTP 授权码（非 QQ 密码，需在 QQ 邮箱设置中生成） |
| 测试连接 | 验证 SMTP 配置是否正确 |
| 日记提醒时间 | 每日发送日记反思提醒的时间（默认 22:30） |
| 日记提醒开关 | 开启/关闭日记提醒 |
| 博客提醒时间 | 每周发送博客写作提醒的时间（默认周日 10:00） |
| 博客提醒开关 | 开启/关闭博客提醒 |

**GitHub**
| 设置项 | 说明 |
|--------|------|
| 远程仓库地址 | GitHub 私有数据仓库 URL |
| 分支 | Git 分支名（默认 main） |
| 验证远程 | 检查远程仓库是否可访问 |
| 一键同步 | 拉取远程数据 → 合并 → 推送本地数据 |

## 邮件提醒

配置 QQ 邮箱 SMTP 后，应用会在设定时间自动发送邮件提醒。

### 日记提醒

每天定时发送，邮件包含：
- 当天的日记摘要（专注数据和反思区域内容）
- 角色化提醒文本，语气根据当日专注完成度动态变化：
  - 完成度 ≥ 80%：**称赞语气**（如"做得不错，今天的专注度很高！"）
  - 完成度 60%-80%：**中性语气**（鼓励继续加油）
  - 完成度 < 60%：**鞭策语气**（提醒不要松懈）
- 角色署名随机轮换（凉宫春日、牧濑红莉栖、椎名真白 等）

### 博客提醒

每周定时发送，邮件包含：
- 本周专注数据汇总（按日期和事项分组）
- 博客写作提示和切入点建议
- 可直接复制到博客中的统计数据

### 手动测试

设置页提供「测试发送提醒邮件」和「测试发送博客邮件」按钮，可选择已有日记日期发送一封测试邮件，方便验证邮箱配置和日记文件读取是否正常。

## 双 PC 数据同步

### 原理

多设备同步需要一个独立的 GitHub 私有仓库来存储数据（与 MoeFocus 源码仓库分开）：

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  本仓库 (MoeFocus 源码)  │     │  数据仓库 (你的私有仓库)     │
│  github.com/xxx/moefocus │     │  github.com/you/moefocus-data │
├─────────────────────────┤     ├──────────────────────────┤
│  React/Electron 代码     │     │  sums/  日记 Markdown     │
│  CSS / 组件              │     │  data/  JSON 数据导出      │
│  构建配置                │     │  .gitignore (排除 *.db)    │
└─────────────────────────┘     └──────────────────────────┘
```

### 配置步骤

1. 在 GitHub 创建一个**空的私有仓库**（例如 `moefocus-data`），**不要**勾选任何初始化选项
2. 打开 MoeFocus → 设置 → GitHub 标签页
3. 输入仓库地址（如 `https://github.com/你的用户名/moefocus-data.git`）→ 点击「验证远程」
4. 点击「一键同步」即可拉取/推送数据
5. 确保系统已配置 Git 凭证管理器：
   ```
   git config --global credential.helper manager
   ```
6. 在另一台电脑上安装 MoeFocus，重复步骤 2-5

### 同步的数据

| 同步内容 | 文件 | 合并方式 |
|----------|------|----------|
| 专注会话记录 | `data/focus_sessions.json` | UUID 索引取并集，同 UUID 以本地为准 |
| 长期目标 | `data/long_term_goals.json` | UUID 索引取并集，按 `updated_at` 时间戳选最新 |
| 日记 Markdown | `sums/YYYY-MM-DD.md` | 统计区从会话数据重新生成；反思区按语义合并 |

### 不同步的内容

- 自定义壁纸文件（每台电脑独立管理）
- SQLite 数据库文件（通过 `.gitignore` 排除）
- 任务库和 TODO 列表（待后续版本支持）

### 同步流程

每次点击「一键同步」或应用启动自动同步时，完整流程为：

1. **导出**：本地专注会话和长期目标导出为 JSON
2. **拉取**：Git fetch → reset 对齐远程历史
3. **合并**：JSON 文件 UUID 取并集；MD 日记语义合并（反思区保护用户手写内容）
4. **推送**：合并结果 commit + push
5. **导入**：新 UUID 的会话和目标写入本地数据库（`INSERT OR IGNORE`）
6. **重建日记**：从合并后的完整数据库重新生成所有日记的统计区
7. **再次推送**：将重新生成的日记推送回远程（如有新数据导入）

### 日记反思的清空与同步

日记的「自我反思」区域采用特殊同步策略：

- 当你点击「清空自定义总结」，文件中会写入清空标记 `<!-- moe:reflection:cleared -->`
- 同步时，如果本地有清空标记，远程的旧反思**不会**被拉回覆盖
- 如果清空后又写了新内容，系统会自动识别并保留新内容，清空标记自动失效
- 这样确保了"删掉的反思不会因为同步而复现"

### 开机自动同步

应用启动时会自动执行一次同步（如已配置远程仓库），确保打开应用时数据是最新的。

## 数据存储

### 本地数据库

所有应用数据存储在 SQLite 数据库中：

```
%APPDATA%/moefocus/moefocus.db
```

| 表名 | 内容 |
|------|------|
| `tasks` | 预设任务库（科目/事项模板） |
| `todo_items` | 每日 TODO 列表 |
| `focus_sessions` | 专注会话记录（UUID、时长、事项、日期） |
| `diary_entries` | 日记条目（Markdown 全文、反思文本、文件路径） |
| `long_term_goals` | 长期目标（UUID、标题、截止日期、状态） |
| `settings` | 应用设置（键值对） |
| `wallpapers` | 自定义壁纸记录 |

### 日记文件

每日生成的 Markdown 日记：

```
%APPDATA%/moefocus/sums/YYYY-MM-DD.md
```

### 同步数据

用于双 PC 同步的 JSON 导出文件：

```
%APPDATA%/moefocus/data/focus_sessions.json
%APPDATA%/moefocus/data/long_term_goals.json
```

### 自定义壁纸

在「设置 → 通用 → 自定义壁纸」中选择本地图片作为全局背景和日记页大图。

- 支持格式：jpg / jpeg / png / gif / webp / bmp
- 壁纸选中后立即生效，毛玻璃面板方便欣赏壁纸
- 壁纸路径记录在数据库中，重启后自动恢复

### 日记相框图片

日记页支持从 `moefocus/diary-pictures/` 目录自动加载图片并轮播展示。

- 图片文件名**必须使用英文**命名（如 `photo.png`），中文文件名会导致路径识别失败
- 轮播间隔和开关可在「设置 → 通用 → 日记相框」中调整
- 支持格式：jpg / png / gif / webp / bmp

## 目录结构

```
├── moefocus/                     # 桌面端 (Electron + React)
│   ├── electron/                 # Electron 主进程
│   │   ├── main.ts               # 应用入口，窗口创建，开机同步
│   │   ├── preload.ts            # 安全桥接层，contextBridge 暴露 API
│   │   ├── ipc/
│   │   │   └── index.ts          # 所有 IPC 处理器（70+ handler）
│   │   ├── services/
│   │   │   ├── DatabaseService.ts    # SQLite 数据库封装 (sql.js)
│   │   │   ├── DiaryService.ts       # 日记生成与清空 (Markdown 合并)
│   │   │   ├── SyncService.ts        # 同步合并逻辑 (日记语义合并 / JSON UUID 合并)
│   │   │   ├── GitService.ts         # Git 操作封装 (simple-git)
│   │   │   ├── EmailService.ts       # QQ 邮件服务 (nodemailer)
│   │   │   ├── SchedulerService.ts   # 定时任务 (node-cron)
│   │   │   ├── TyporaService.ts      # Typora 启动器
│   │   │   └── reminder_text_library.ts  # 邮件角色化文本库
│   │   └── database/
│   │       └── schema.sql        # 数据库建表语句 + 默认设置
│   ├── src/                      # React 渲染进程
│   │   ├── main.tsx              # React 入口
│   │   ├── App.tsx               # 根组件（路由 + 布局）
│   │   ├── pages/                # 页面组件
│   │   │   ├── TodayPage.tsx         # 今日：任务库 + TODO + 计时器
│   │   │   ├── FocusPage.tsx         # 专注计时页面
│   │   │   ├── DiaryPage.tsx         # 日记：查看/生成/清空/删除
│   │   │   ├── StatisticsPage.tsx    # 统计：周/月图表
│   │   │   ├── LongTermTasksPage.tsx # 长期目标管理
│   │   │   └── SettingsPage.tsx      # 设置：通用/计时/邮箱/GitHub
│   │   ├── components/
│   │   │   ├── layout/           # 标题栏 / 侧边栏 / 背景 / 窗口控制
│   │   │   ├── tasks/            # 任务库 / TODO 列表 / 拖拽
│   │   │   ├── timer/            # 专注计时器 UI
│   │   │   ├── diary/            # 日记渲染 / Markdown 预览
│   │   │   ├── stats/            # 图表组件 (recharts)
│   │   │   ├── settings/         # 设置面板 / Git 状态 / 邮件配置
│   │   │   ├── widgets/          # 樱花特效 / 相框轮播
│   │   │   └── common/           # 通用 UI (按钮 / 输入框 / 卡片 / 模态框)
│   │   ├── store/                # Zustand 全局状态
│   │   ├── hooks/                # 自定义 Hook (计时器 / 设置 / 拖拽)
│   │   ├── styles/               # 全局样式 / 主题 / CSS 变量
│   │   ├── types/                # TypeScript 类型定义
│   │   └── assets/               # 壁纸 / 字体 / 图标
│   ├── resources/                # 打包资源 (应用图标)
│   ├── package.json
│   ├── electron.vite.config.ts
│   └── electron-builder.yml
├── moefocus-mobile/              # 移动端 (React Native + Expo)
│   ├── App.tsx
│   ├── src/screens/              # Today / Focus / Stats / Settings
│   ├── src/store/                # Zustand stores
│   ├── src/services/             # expo-sqlite database
│   └── src/styles/               # Moe theme
├── dev-history/                  # 开发历史与功能说明文档
└── review/                       # 学习文档 (架构/阶段记录/数据管理)
```

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

> `.npmrc` 已将 npm 包下载指向 `registry.npmmirror.com`。Electron 二进制文件需通过环境变量 `ELECTRON_MIRROR` 指定镜像，因为它不走 npm registry。

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
| 动画 | framer-motion |
| Markdown 渲染 | react-markdown + remark-gfm |
| 数据库 | sql.js (SQLite WASM) |
| 邮件 | nodemailer (QQ SMTP) |
| Git | simple-git |
| 定时任务 | node-cron |
| 日期处理 | dayjs |
| 图标 | react-icons |

## 许可

MIT License
