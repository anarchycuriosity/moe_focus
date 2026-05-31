# 12 — 日记删除级联清理专注数据 + 统计同步

## 用户需求

删除某天日记后，该日期的专注数据应该同步清除，统计图表对应减少。

场景：
- 第 1 天：事件 A 专注 2h → 日记 + 专注会话存在
- 第 2 天：事件 A 专注 2h → 日记 + 专注会话存在
- 删除第 1 天日记 → **同步** → 第 1 天专注会话清除 → 统计对 A 仅显示 2h

## 现状分析

删除日记的当前流程（`diary:deleteEntry`）：

```
DELETE FROM diary_entries WHERE date = ?
```

只删了一行，**没有动 focus_sessions、sums/ 文件**。统计查询只看 `focus_sessions` 表，与 `diary_entries` 无 JOIN，所以统计数据纹丝不动。

`focus_sessions` 和 `diary_entries` 之间的唯一联系是共享 `date` 字段。两个表没有外键关联。

## 修复方案

### 1. diary:deleteEntry 级联删除

```
删除日记 →
  1. DELETE FROM focus_sessions WHERE date = ?   ← 级联
  2. DELETE FROM diary_entries WHERE date = ?
  3. fs.unlinkSync(sums/YYYY-MM-DD.md)           ← 清理磁盘
  4. return { success, deleted_sessions: N }
```

**只删 focus_sessions，保留 todo_items。** 待办事项是独立的任务规划数据，不应随日记销毁。

### 2. stats:syncCleanup 孤儿清理

新增 IPC handler，处理历史遗留的孤儿数据（早期删除日记时 focus_sessions 未被级联清除）：

```sql
DELETE FROM focus_sessions
WHERE date NOT IN (SELECT DISTINCT date FROM diary_entries)
```

返回 `cleaned_sessions` 计数供 UI 反馈。

### 3. 统计页「同步」按钮

`StatsDashboard.tsx`：
- 新增 `🔄 同步数据` 按钮（ghost 风格，与现有控件同行）
- 点击 → `stats:syncCleanup` → 显示清理消息 → `refresh_trigger` 递增
- `refresh_trigger` 传递给 WeeklyChart / MonthlyChart / FocusBreakdown
- 子组件 useEffect 依赖 `refresh_trigger`，变化时重新拉取数据

子组件使用 `refresh_trigger` prop 而非 `key` 强制重挂载，避免图表闪烁。

## 关键文件变更

| 层 | 文件 | 变更 |
|---|------|------|
| Handler | `electron/ipc/index.ts` | `diary:deleteEntry` 级联删除 + 新增 `stats:syncCleanup` |
| Preload | `electron/preload.ts` | `stats.sync_cleanup()` |
| 类型 | `src/types/electron.d.ts` | `BreakdownRow` 接口 + `sync_cleanup` 方法签名（顺便补了缺失的 `get_weekly_breakdown`/`get_monthly_breakdown`） |
| UI | `src/components/stats/StatsDashboard.tsx` | 同步按钮 + `refresh_trigger` 状态 |
| UI | `WeeklyChart.tsx`, `MonthlyChart.tsx`, `FocusBreakdown.tsx` | 新增 `refresh_trigger` prop，加入 useEffect 依赖 |

## 设计决策

- **todo_items 不动** — 待办是独立数据，删除日记不应销毁
- **级联删除是即时操作**，不是软删除 — 用户需求就是「统计减少」，延迟没有意义
- **同步按钮处理历史残留** — 一次性的批量清理，之后每次删除日记都级联清理，理论不再产生孤儿
- **refresh_trigger 而非 key 强制重挂载** — 子组件平滑刷新，无 UI 闪烁
