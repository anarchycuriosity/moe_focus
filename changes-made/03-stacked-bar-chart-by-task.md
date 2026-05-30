# 03 — 统计柱状图改为按任务分色的堆叠柱状图

## 问题现象

统计模块的柱状图只显示每天/每周的总专注时间（分钟），无法看到每个事项分别花了多少时间。月统计中同名任务也没有合并。

用户需求：
- 每根柱子上用不同颜色块区分当天/当周的不同事项
- 月统计中，同名任务要合并（如第1天的"学习日语"和第3天的"学习日语"算在一起）

## 根因分析

原有 API `stats:getWeekly` 和 `stats:getMonthly` 只返回按日期汇总的总秒数：

```sql
-- 旧查询：每天只返回一行，丢失事项信息
SELECT date, SUM(actual_duration_sec) as total_seconds
FROM focus_sessions
WHERE ...
GROUP BY date
```

前端 `WeeklyChart` 和 `MonthlyChart` 拿到的是 `{date, total_seconds}` 结构，无法做堆叠图。

## 修复方案

### 后端 (IPC + preload)

新增两个 API，返回按日期+事项粒度分组的数据：

```sql
-- 新查询：每天每个事项一行
SELECT fs.date,
       COALESCE(t.title, fs.subject) as subject,
       COALESCE(t.color, '#FFB7C5') as color,
       SUM(fs.actual_duration_sec) as total_seconds
FROM focus_sessions fs
LEFT JOIN todo_items ti ON fs.todo_id = ti.id
LEFT JOIN tasks t ON ti.task_id = t.id
WHERE ...
GROUP BY fs.date, subject
```

### 前端图表重写

**WeeklyChart**：
1. 从原始数据提取所有唯一 subject 及其颜色
2. 构建 7 天的数据结构，每天包含所有 subject 对应的分钟数
3. 使用 Recharts `<BarChart>` + 多个 `<Bar stackId="week">` 实现堆叠效果
4. 饼图模式改为横向柱状图（按事项汇总）

**MonthlyChart**：
1. 按日期归入第1-5周（`Math.ceil(dom/7)`）
2. 同一周内同名 subject 自动合并秒数
3. 构建 5 周的数据结构，使用堆叠柱状图或横向柱状图

### 颜色分配策略

- 优先使用任务在 `tasks` 表中定义的 `color` 字段
- 未定义颜色的使用 fallback 颜色列表循环分配
- 同一 subject 在所有柱子上颜色保持一致

## 涉及文件

- `moefocus/electron/ipc/index.ts` — 新增 stats:getWeeklyBreakdown 和 stats:getMonthlyBreakdown
- `moefocus/electron/preload.ts` — 暴露新 API
- `moefocus/src/components/stats/WeeklyChart.tsx` — 完全重写为堆叠柱状图
- `moefocus/src/components/stats/MonthlyChart.tsx` — 完全重写为周堆叠柱状图（同名合并）
