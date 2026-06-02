# 13: 数据同步失败 —— checkout -B 静默失败 + 缺少会话数据同步

## 问题现象

在另一台 PC 上点击「一键同步」，6月1号的日记和统计时间都没能同步过来。

## 根因分析

### 根因 1 (CRITICAL): `checkout -B` 因工作区脏文件静默失败

旧 `sync()` 流程：

```
fetch → 快照 sums/*.md → checkout -B main origin/main → 读远程文件 → merge → commit → push
```

关键失败点在 `checkout -B`：

- `git checkout -B <branch> origin/<branch>` 会尝试将工作区重置到远程 HEAD
- 若工作区存在**已追踪文件的未提交修改**（如 DiaryService 或 SchedulerService 自动刷新了 `sums/*.md`），**git 会拒绝 checkout** 以避免覆盖本地修改
- 旧代码 catch 块**静默吞掉此错误**，`remote_has_branch` 保持 `false`
- 后果：`current_files` 读取的还是本地文件，merge 变成 local vs local 的 no-op，**远程数据从未被拉取**
- 用户看到 sync 返回 `success: true`，但实际同步未发生

### 根因 2 (DESIGN): `focus_sessions` 表数据从未同步

- 统计图表 (WeeklyChart / MonthlyChart / DailyFocusRing) 查询 `focus_sessions` SQLite 表
- 该表是本地的，`.gitignore` 明确排除 `*.db`
- `sums/*.md` 是从 `focus_sessions` **派生**的汇总输出，不是源数据
- 同步 `sums/*.md` 不会更新任何 PC 本地的 SQLite 数据库
- → 即使 sums 文件正确同步，统计数据也不会反映远程 PC 的会话

## 修复方案

### Commit 1: 用 `git show` 替代 `checkout -B`

**核心思想**: 不修改工作区即可读取远程文件内容。

新流程：

```
fetch → 快照本地 sums/*.md + data/*.json
     → git ls-remote origin <branch>  确认远程分支存在
     → git ls-tree origin/<branch>:sums/   列出远程文件
     → git show origin/<branch>:sums/<file> 逐文件读取内容
     → 逐文件 merge（本地 ∩ 远程 → 语义合并 / 仅本地 → 保留 / 仅远程 → 拉取）
     → git add + commit + push
```

**关键改进**:
- 完全消除 `checkout`，不再触碰工作区 git 状态
- 工作区脏文件不影响远程数据拉取
- `git ls-remote` 精确判断远程分支是否存在
- `git show` 按需读取单个文件，不触发任何工作区修改

### Commit 2 (下一个): 同步 `focus_sessions` JSON

- 为每条 session 分配全局 UUID
- 导出 `data/focus_sessions.json` (`{ uuid: session_data, ... }`)
- 合并时按 UUID 取并集（无冲突，UUID 全局唯一）
- 导入端 `INSERT OR IGNORE` 新 UUID 的会话到本地 SQLite
- 导入后重新生成当日日记

## 涉及文件

| 文件 | 改动 |
|------|------|
| `electron/services/GitService.ts` | sync() 方法完全重写 |
