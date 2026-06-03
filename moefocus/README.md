# MoeFocus

受 Windows 专注钟启发的一款萌系日程管理应用，集专注计时、日记生成、数据同步于一体。

## 数据同步

### 原理

MoeFocus 使用 GitHub 私有仓库作为数据中转站，实现去中心化的跨 PC 数据同步。

同步的数据分两类，处理方式不同：

| 数据类型 | 存储格式 | 合并策略 |
|----------|----------|----------|
| 专注会话 (focus_sessions) | `data/focus_sessions.json` (UUID → 对象映射) | UUID 去重浅合并 |
| 日记 (diary entries) | `sums/YYYY-MM-DD.md` (Markdown) | 从数据库重新生成（不直接合并 MD） |

核心思路：**源数据用 UUID 去重，派生数据从 DB 重新生成**。

### 完整同步流程

```
export sessions → git fetch → git reset --hard origin/main
→ merge JSON (UUID 去重) → commit + push
→ import sessions to DB → regenerate diaries → sync diary_entries
```

### 配置步骤

1. 在 GitHub 创建一个**私有**仓库（如 `moefocus-data`）
2. 打开 MoeFocus → 设置 → GitHub 标签页
3. 填写远程仓库地址和分支名，点击「应用远程地址」
4. 点击侧边栏底部的 🔄 按钮即可一键同步

### 同步入口

- **侧边栏 🔄 按钮**：GUI 一键同步，hover 显示诊断详情
- **统计页同步按钮**：同步 + 清理孤儿数据 + 刷新图表
- **DevTools Console**：`__moe_sync__()` 可在 GUI 外直接测试

### 诊断信息说明

同步完成后，侧边栏 tooltip 显示：
- `远程日记: X篇` — 远程仓库中的日记文件数
- `远程数据: X文件` — 远程仓库中的 JSON 数据文件数
- `新会话: X条` — 本次导入的新专注会话数
- `已同步: X天日记` — 同步到 diary_entries 表的天数

若显示「数据已是最新 (远程无新内容)」，说明本地和远程完全一致。

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 启动开发模式 (Electron + React HMR)
npm run build      # 生产构建
```

## 技术栈

- **前端**：React 18 + TypeScript + Zustand + Recharts + @dnd-kit
- **后端**：Electron + sql.js (SQLite WASM) + node-cron + simple-git
- **邮件**：nodemailer + QQ SMTP
- **构建**：electron-vite
