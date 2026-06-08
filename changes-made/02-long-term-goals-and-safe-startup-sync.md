# 02 - 长期任务同步与安全启动：不要让网络配置阻塞应用打开

## 一、问题背景

这次修改覆盖四个产品问题：

1. 侧边栏需要一个长期任务模块，并显示截止日期。
2. 长期任务不应该挤在侧边栏小弹窗里，而应该和「统计」「日记」同级，点击后进入独立页面。
3. 侧边栏同步按钮也需要明确反馈，不能只把结果藏在鼠标悬停提示里。
4. 应用启动时会自动同步远程仓库，如果用户没有配置仓库、仓库地址错误、网络失败，不能影响应用正常打开。

这些问题属于“本地优先应用”的典型设计主题：软件应该先让用户进入界面，再在后台做网络同步。

## 二、前置知识

### 2.1 本地优先

本地优先的意思是：应用核心功能依赖本地数据库或本地文件，网络同步只是增强能力。

错误设计：

```text
启动应用 -> 先访问网络 -> 网络成功 -> 打开窗口
```

问题是网络不稳定，远程仓库也可能配置错误。一旦网络步骤卡住，用户连本地数据都打不开。

更稳的设计：

```text
启动应用 -> 初始化本地数据库 -> 打开窗口 -> 后台尝试同步
```

这样即使远程仓库不可用，用户仍然可以查看和编辑本地数据。

### 2.2 一级模块与小工具的区别

长期任务天然不止一条，还需要筛选、截止日期、状态、逾期提示和批量浏览空间。因此它不是一个适合塞进侧边栏的小工具，而是一个一级功能模块。

判断标准很简单：

- 如果用户只是偶尔点一下，它可以是按钮或弹窗。
- 如果用户需要反复查看、比较、管理多条记录，它应该是页面。

长期任务属于后者。

### 2.3 删除同步为什么需要墓碑记录

长期任务要跨设备同步，因此不能只做物理删除。

假设：

```text
电脑 A：删除任务 X
电脑 B：还保存着任务 X
同步后：如果没有删除标记，电脑 B 的旧数据可能把任务 X 又同步回来
```

所以这次使用 `is_deleted` 字段做软删除。它的作用不是展示给用户，而是告诉其他设备：“这条记录已经被删除过，不要复活它。”

这类删除标记常被称为 tombstone。

### 2.4 UUID 是跨设备同步的身份

数据库自增 `id` 只在本机有意义。两台电脑各自新增任务时，可能都会生成 `id = 1`。

因此同步时不能靠 `id`，要靠 UUID：

```text
uuid -> 全局身份
updated_at -> 谁更新得更晚
is_deleted -> 是否已经被删除
```

长期任务同步使用：

```text
data/long_term_goals.json
```

文件名暂时沿用旧内部命名以保持兼容，但用户界面统一叫“长期任务”。

## 三、这次的实现策略

### 3.1 长期任务一级页面

侧边栏本身只有 72px 宽，不适合硬塞完整表格。因此长期任务作为和「统计」「日记」同级的一级模块：

- 侧边栏显示「长期」入口。
- 点击后跳转到独立长期任务页面。
- 页面内可以新增任务、设置截止日期、标记完成、删除任务。
- 页面顶部显示进行中、逾期、已完成数量。
- 列表中显示任务标题、截止日期、剩余天数和状态标签。

### 3.2 同步反馈

侧边栏同步按钮现在会显示可见状态：

- 同步中。
- 同步成功，并显示同步了哪些数据。
- 同步失败，并显示错误信息。

这比 `title` tooltip 可靠，因为用户不需要猜，也不需要把鼠标停在按钮上。

### 3.3 启动同步改为后台执行

修改前：

```text
初始化数据库 -> 注册 IPC -> 启动同步 -> 创建窗口
```

修改后：

```text
初始化数据库 -> 注册 IPC -> 创建窗口 -> 后台启动同步
```

这样远程仓库异常不会阻止应用窗口出现。

### 3.4 仓库配置审查

设置页新增“审查并应用远程地址”逻辑：

1. 初始化本地 Git 仓库。
2. 使用 `git ls-remote --heads <url> <branch>` 检查远程仓库是否可访问。
3. 检查通过后才写入本地 `origin`。
4. 如果地址为空，则移除 `origin`，相当于关闭远程同步。

## 四、关键数据结构

长期任务表：

```sql
CREATE TABLE IF NOT EXISTS long_term_goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  deadline    TEXT,
  status      TEXT DEFAULT 'active',
  sort_order  INTEGER DEFAULT 0,
  is_deleted  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

同步 JSON 结构：

```json
{
  "uuid-1": {
    "title": "完成 CS61A",
    "deadline": "2026-08-01",
    "status": "active",
    "is_deleted": 0,
    "updated_at": "2026-06-08 12:00:00"
  }
}
```

## 五、推荐学习资料

- MIT 6.824 / 6.5840：分布式系统，理解同步、一致性和冲突。
- CS61B：数据结构，尤其是哈希表、集合和映射。
- Martin Kleppmann《Designing Data-Intensive Applications》：重点看复制、冲突解决、离线同步。
- Git 官方文档：学习 `remote`、`fetch`、`ls-remote`、分支和引用。

## 六、项目作业

做一个“跨设备长期任务同步器”：

1. 每条任务必须有 UUID。
2. 支持新增、修改、完成、删除。
3. 删除不能物理删除，要写 `is_deleted = 1`。
4. 导出为 JSON。
5. 导入时按 UUID 合并，`updated_at` 更新的记录胜出。

进阶要求：

1. 两台电脑同时修改同一任务时，显示冲突提示。
2. 支持恢复已删除任务。
3. 把长期任务同步文件提交到 Git 仓库。

## 七、本次修改文件

| 文件 | 作用 |
| --- | --- |
| `electron/database/schema.sql` | 新增长期任务表和索引 |
| `electron/services/DatabaseService.ts` | 为老用户数据库补迁移 |
| `electron/services/SyncService.ts` | 导出/导入长期任务 JSON |
| `electron/services/GitService.ts` | 新增远程仓库审查，支持清空 origin |
| `electron/main.ts` | 启动同步改为窗口出现后的后台任务 |
| `electron/ipc/index.ts` | 新增长期任务 IPC 与同步接入 |
| `electron/preload.ts` | 暴露长期任务和远程审查 API |
| `src/components/layout/Sidebar.tsx` | 新增长期任务一级入口和侧边栏同步反馈 |
| `src/pages/LongTermTasksPage.tsx` | 新增长期任务列表页面 |
| `src/pages/LongTermTasksPage.module.css` | 新增长期任务页面样式 |
| `src/pages/SettingsPage.tsx` | 远程仓库配置改为审查通过后应用 |
| `src/types/electron.d.ts` | 补全渲染进程类型声明 |
