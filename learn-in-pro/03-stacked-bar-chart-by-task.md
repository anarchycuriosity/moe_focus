# 03 — SQL 聚合与 JOIN：按事项分色的堆叠柱状图

## 问题现象

统计图表只显示每天/每周的总专注时间（一根纯色柱子），看不到每个事项（数学、英语、编程等）分别花了多少时间。

用户想知道「这一周数学学了多久，英语学了多久」，但图表无法提供这个维度的信息。

## 一、前置知识

### 1.1 数据库聚合（Aggregation）

聚合是数据库最核心的能力之一。它把多行数据按照某个规则"合并"成更少的汇总行。

**现实类比：超市小票**

你有购物小票的原始数据：

| id | 日期 | 商品 | 金额 |
|----|------|------|------|
| 1 | 6/1 | 牛奶 | 15 |
| 2 | 6/1 | 面包 | 8 |
| 3 | 6/1 | 牛奶 | 15 |
| 4 | 6/2 | 鸡蛋 | 20 |
| 5 | 6/2 | 面包 | 8 |

现在想问不同的问题：

**问题 1："每天花了多少钱？"**

```sql
SELECT date, SUM(amount) AS total_amount
FROM receipts
GROUP BY date
```

结果（3 行变成 2 行）：

| date | total_amount |
|------|-------------|
| 6/1 | 38 |
| 6/2 | 28 |

**问题 2："每种商品总共卖了多少钱？"**

```sql
SELECT item, SUM(amount) AS total_amount
FROM receipts
GROUP BY item
```

结果：

| item | total_amount |
|------|-------------|
| 牛奶 | 30 |
| 面包 | 16 |
| 鸡蛋 | 20 |

**问题 3："每天每种商品卖了多少钱？"**

```sql
SELECT date, item, SUM(amount) AS total_amount
FROM receipts
GROUP BY date, item
ORDER BY date
```

结果（分组更细，行数更多）：

| date | item | total_amount |
|------|------|-------------|
| 6/1 | 牛奶 | 30 |
| 6/1 | 面包 | 8 |
| 6/2 | 鸡蛋 | 20 |
| 6/2 | 面包 | 8 |

这就是 GROUP BY 的核心规律：
- **GROUP BY 后面的列越多，分组越细，结果行越多**
- **每一组内的所有行被"压缩"成一行，聚合函数（SUM/COUNT/AVG/MAX/MIN）在这个组内计算**

```
5 行原始数据
  → GROUP BY date（2 个不同的日期）→ 2 行结果
  → GROUP BY date, item（4 种日期×商品组合）→ 4 行结果
```

> **经典源码学习**：数据库的 GROUP BY 通常使用**哈希聚合（Hash Aggregation）**或**排序聚合（Sort Aggregation）**两种算法。PostgreSQL 的哈希聚合实现见 `src/backend/executor/nodeAgg.c`，核心思路是：建立一个哈希表，key 是 GROUP BY 列的组合值，value 是累积的聚合状态（对于 SUM 就是一个累加器）。每来一行数据，查哈希表找到对应的聚合状态，更新累加器。

### 1.2 为什么 GROUP BY date 丢失了事项信息？

MoeFocus 旧查询的问题：

```sql
-- 旧查询：只按日期分组
SELECT date, SUM(actual_duration_sec) AS total_seconds
FROM focus_sessions
WHERE status = 'completed'
GROUP BY date
```

```
原始数据（focus_sessions 表）：
| date  | subject | actual_duration_sec |
|-------|---------|--------------------|
| 6/1   | 数学     | 3600               |
| 6/1   | 英语     | 1800               |
| 6/2   | 数学     | 2700               |
| 6/2   | 编程     | 5400               |

GROUP BY date → 每天一行：
| date  | total_seconds |
|-------|--------------|
| 6/1   | 5400         |  ← 数学 3600 + 英语 1800 = 5400，但不知道各自多少
| 6/2   | 8100         |  ← 数学 2700 + 编程 5400 = 8100，同样丢失了细节
```

**核心规律**：GROUP BY 的列 = 你在结果中"能区分"的维度。GROUP BY date 意味着你只能区分"6月1日 vs 6月2日"，不能区分"数学 vs 英语"。

解决方案：把 subject 也加入 GROUP BY：

```sql
-- 新查询：按日期+事项两个维度分组
SELECT date, subject, SUM(actual_duration_sec) AS total_seconds
FROM focus_sessions
WHERE status = 'completed'
GROUP BY date, subject     -- ← 两个分组维度
ORDER BY date
```

```
结果保持所有细节：
| date  | subject | total_seconds |
|-------|---------|--------------|
| 6/1   | 数学     | 3600         |
| 6/1   | 英语     | 1800         |
| 6/2   | 数学     | 2700         |
| 6/2   | 编程     | 5400         |
```

### 1.3 SQL JOIN：把分散在多个表中的数据连起来

MoeFocus 有三个重要的表：

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   tasks     │     │  todo_items  │     │ focus_sessions  │
├─────────────┤     ├──────────────┤     ├─────────────────┤
│ id (PK)     │←──│ task_id (FK)  │     │ id (PK)         │
│ title       │    │ id (PK)      │←──│ todo_id (FK)     │
│ color       │    │ date         │    │ subject          │
│ icon        │    │ status       │    │ actual_duration  │
│ category    │    │ sort_order   │    │ status           │
└─────────────┘     └──────────────┘    │ date             │
                                        │ uuid             │
    "任务模板"         "今日待办"          └─────────────────┘
    预设的任务列表      每天要做的具体任务      "专注会话"
                      可拖拽排序            每次专注的完整记录
```

专注会话（focus_sessions）记录了每次专注的时间，但事项的名称和颜色在 tasks 表中。它们之间通过 todo_items 间接关联：

```
focus_sessions.todo_id → todo_items.id → todo_items.task_id → tasks.id → tasks.title
                                                                       → tasks.color
```

**JOIN 的作用**：把分散在多个表中的相关数据"拼"到一行结果中。

```sql
SELECT
  fs.date,                                         -- 来自 focus_sessions
  COALESCE(t.title, fs.subject) AS subject,        -- 优先用 tasks 的名称
  COALESCE(t.color, '#FFB7C5')  AS color,          -- 优先用 tasks 的颜色
  SUM(fs.actual_duration_sec)  AS total_seconds
FROM focus_sessions fs
LEFT JOIN todo_items ti ON fs.todo_id = ti.id       -- 第一跳
LEFT JOIN tasks t       ON ti.task_id = t.id         -- 第二跳
WHERE fs.status = 'completed'
GROUP BY fs.date, subject
```

**JOIN 类型对比**：

| JOIN 类型 | 行为 | 何时使用 |
|-----------|------|---------|
| `INNER JOIN` | 只返回两边都能匹配的行 | 确定关联一定存在 |
| `LEFT JOIN` | 保留左表所有行，右表匹配不上的填 NULL | 关联可能不存在（推荐默认使用） |
| `RIGHT JOIN` | 保留右表所有行 | 极少使用（SQLite 不支持） |
| `FULL OUTER JOIN` | 保留两边所有行 | 两边都可能缺失时 |

MoeFocus 用 LEFT JOIN 的原因：用户可能没从任务库选择任务就直接开始专注（手打了一个事项名）。此时 `todo_id` = NULL → 第一个 LEFT JOIN 返回 NULL → 第二个 LEFT JOIN 也返回 NULL → `t.title` 和 `t.color` 都是 NULL → `COALESCE` 发挥作用，用 `fs.subject`（用户手打的名称）和默认粉色 `#FFB7C5` 兜底。

如果用了 INNER JOIN，那些没有关联任务库的专注会话就**直接消失**了——数据丢失。

> **经典源码学习**：数据库的 JOIN 实现通常有三种算法：Nested Loop Join、Hash Join、Merge Join。MySQL 8.0 的 Hash Join 实现见 `sql/hash_join_buffer.h` 和 `sql/hash_join_iterator.cc`。理解 JOIN 算法的选择条件（小表用 Nested Loop + Index，大表用 Hash Join）是后端性能优化的基本功。

### 1.4 COALESCE：处理 NULL 的标准方式

```sql
COALESCE(a, b, c, d)  -- 返回参数列表中第一个非 NULL 的值
```

```sql
-- 示例
COALESCE(NULL, NULL, 'hello', 'world') → 'hello'
COALESCE(NULL, 42)                     → 42
COALESCE(NULL, NULL, NULL)             → NULL  (全是 NULL 则返回 NULL)
```

在 MoeFocus 中的应用：

```sql
COALESCE(t.title, fs.subject) AS subject
-- 如果任务库中有名称，用任务库的（更规范）
-- 如果用户是手打的名称（没有关联任务），用 fs.subject
-- 无论如何，subject 列不会为 NULL

COALESCE(t.color, '#FFB7C5') AS color
-- 如果任务库中有颜色，用任务库的
-- 否则用默认粉色 #FFB7C5
```

### 1.5 堆叠柱状图的数据结构（Pivot 操作）

Recharts 的堆叠柱状图需要"宽格式"数据：

```typescript
// 宽格式（Wide Format）— 图表库需要
[
  { date: 'Mon', '数学': 45, '英语': 30, '编程': 0 },
  { date: 'Tue', '数学': 60, '英语': 0,  '编程': 25 },
]
```

但数据库返回的是"长格式"数据：

```typescript
// 长格式（Long Format）— 数据库返回
[
  { date: 'Mon', subject: '数学', minutes: 45 },
  { date: 'Mon', subject: '英语', minutes: 30 },
  { date: 'Tue', subject: '数学', minutes: 60 },
  { date: 'Tue', subject: '编程', minutes: 25 },
]
```

**从长格式到宽格式的转换过程叫作 Pivot（数据透视）**。

```typescript
function pivot(data: Row[]): PivotedRow[]
{
  // 第一步：提取所有唯一的事项名称
  const subjects = [...new Set(data.map(r => r.subject))]

  // 第二步：提取所有唯一的日期
  const dates = [...new Set(data.map(r => r.date))]

  // 第三步：构建宽格式矩阵
  return dates.map(date => {
    const row: PivotedRow = { date }
    for (const subject of subjects)
    {
      // 找到 (date, subject) 对应的数据
      const match = data.find(r => r.date === date && r.subject === subject)
      row[subject] = match ? match.minutes : 0
    }
    return row
  })
}
```

---

## 二、修复方案

### 后端：新增按日期+事项粒度的 API

```sql
-- 周统计 breakdown
SELECT fs.date,
       COALESCE(t.title, fs.subject) AS subject,
       COALESCE(t.color, '#FFB7C5')  AS color,
       SUM(fs.actual_duration_sec)    AS total_seconds
FROM focus_sessions fs
LEFT JOIN todo_items ti ON fs.todo_id = ti.id
LEFT JOIN tasks t       ON ti.task_id = t.id
WHERE fs.date >= ?
  AND fs.date < date(?, '+7 days')
  AND fs.status = 'completed'
GROUP BY fs.date, subject     -- ← 关键：两个维度分组
ORDER BY fs.date, total_seconds DESC
```

### 前端：数据转换管道

```
数据库 → 长格式数据
  → 提取唯一事项名称 + 颜色映射表
  → 构建 7天×N个事项 的矩阵（缺失值填 0）
  → Pivot 为宽格式
  → 传给 Recharts BarChart（每个事项一个 <Bar stackId="x">）
```

### 颜色一致性

每个事项在所有柱子上的颜色必须一致（如"数学"在周一和周三都是同一种蓝色）。通过建立 `Map<string, string>` 的 subject→color 映射表来保证。

---

## 三、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| GROUP BY 粒度 | GROUP BY 的列决定了你能区分多少细节。分组越细，信息越多 |
| LEFT JOIN vs INNER JOIN | LEFT JOIN 不会丢数据（关联不上就填 NULL），是更安全的选择 |
| COALESCE | 处理 NULL 的标准函数，提供多层 fallback |
| Pivot 操作 | 长格式→宽格式的转换，数据展示层的常见需求 |
| 数据管道 | 数据库(原始) → SQL(聚合) → API(JSON) → 前端(pivot) → 渲染 |

---

## 四、项目作业：构建一个销售数据聚合系统

### 作业目标

用 Node.js + SQLite 实现一个销售数据聚合查询系统，深度练习 GROUP BY、JOIN 和 Pivot 操作。

### 数据模型

```
products (产品表)
  id, name, category, price

customers (客户表)
  id, name, city

orders (订单表)
  id, customer_id, order_date

order_items (订单明细表)
  id, order_id, product_id, quantity, unit_price
```

### 核心要求

1. **初始化脚本**：创建上述 4 个表并填充 50+ 条模拟数据

2. **实现以下聚合查询**（从简单到复杂）：

```sql
-- Q1: 每种产品的总销量和总销售额（GROUP BY 单列 + SUM）
SELECT p.name, SUM(oi.quantity) AS total_qty,
       SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM products p
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.name
ORDER BY total_revenue DESC

-- Q2: 每个城市每月的销售额（GROUP BY 多列 + 日期截断）
SELECT c.city,
       strftime('%Y-%m', o.order_date) AS month,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN order_items oi ON o.id = oi.order_id
GROUP BY c.city, month
ORDER BY month, revenue DESC

-- Q3: 每个产品类别中销售额最高的产品（子查询 + 窗口函数）
-- 提示：用 ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC)
```

3. **Pivot 转换**：把 Q2 的长格式结果转为宽格式（行=城市，列=月份）

4. **封装为 CLI**：

```
npm start query1     → 执行查询1并打印结果表格
npm start query2     → 执行查询2并打印 pivot 后的结果
npm start query3     → 执行查询3
```

### 验收标准

- [ ] 能正确区分 INNER JOIN 和 LEFT JOIN 的使用场景
- [ ] GROUP BY 单列和多列的区别能解释清楚
- [ ] Q1 中如果某个产品从未被购买过（order_items 中没有它的记录），INNER JOIN 和 LEFT JOIN 的结果有何不同？
- [ ] Pivot 后的宽格式表格在终端对齐显示（使用 `console.table` 或手动格式化）

### 思考题

1. 如果 orders 表有 1000 万行，上面 Q2 的查询会很慢。哪些列应该建索引？为什么？
2. `strftime('%Y-%m', o.order_date)` 在 WHERE 条件中会导致索引失效（因为对列做了函数运算）。怎么改写才能用上索引？
3. Pivot 操作通常在前端做还是在后端做？各自的优劣是什么？

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/electron/ipc/index.ts` | 新增 stats:getWeeklyBreakdown / stats:getMonthlyBreakdown handler |
| `moefocus/electron/preload.ts` | 暴露新 API |
| `moefocus/src/components/stats/WeeklyChart.tsx` | 重写为堆叠柱状图 |
| `moefocus/src/components/stats/MonthlyChart.tsx` | 重写为周堆叠柱状图 + 同名合并 |
