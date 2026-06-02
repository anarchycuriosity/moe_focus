# 12 — 数据库关系与级联操作：删除日记为何不影响统计数据

## 问题现象

删除某天日记后，该日期的专注时间仍然出现在统计图表中。用户预期删除日记 → 对应专注数据也消失 → 统计图表自动反映。

## 一、前置知识

### 1.1 关系型数据库中的"关系"

关系型数据库的核心概念是**通过共享的值把不同表中的行关联起来**。

MoeFocus 中两个关键表：

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│     focus_sessions          │   │      diary_entries          │
├─────────────────────────────┤   ├─────────────────────────────┤
│ id (主键)                   │   │ id (主键)                   │
│ subject                     │   │ date (唯一)                  │
│ actual_duration_sec         │   │ summary_text                │
│ status                      │   │ reflection_text             │
│ date ───────────────────────│──→│ date                         │
│ todo_id → todo_items.id     │   │ file_path                   │
└─────────────────────────────┘   └─────────────────────────────┘
          ↑                                    ↑
          隐式关系：两个表通过 date 列"关联"
          但没有正式的外键约束！
```

两个表之间的"关系"是隐式的——它们碰巧都有一个 `date` 列，但数据库不知道它们有关系。对数据库而言，`focus_sessions` 的 `date` 和 `diary_entries` 的 `date` 是两个完全独立的列，恰巧列名一样而已。

**如果有外键约束**（显式关系）：

```sql
-- 假设：diary_entries 引用了 focus_sessions（这只是示例，MoeFocus 没有这样做）
CREATE TABLE diary_entries (
  ...
  FOREIGN KEY (date) REFERENCES focus_sessions(date) ON DELETE CASCADE
);

-- 这时数据库会保证：
-- 1. 不能在 diary_entries 中插入 focus_sessions 中不存在的 date（参照完整性）
-- 2. 删除 focus_sessions 的行时，自动删除 diary_entries 中匹配的行（级联删除）
```

MoeFocus 选择不用外键是有意为之：两个表的生命周期是独立的（可以只有专注会话而没有日记，也可以只有日记模板而没有会话数据），外键的硬约束在这里不合适。

### 1.2 外键（Foreign Key）与级联操作（CASCADE）

外键是关系型数据库维护**参照完整性**（Referential Integrity）的机制。

```sql
-- 标准的外键定义
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_name TEXT,
  quantity INTEGER,

  -- 外键约束：order_id 必须存在于 orders 表中
  FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE    -- 删除订单时自动删除其所有订单项
    ON UPDATE CASCADE    -- 更新订单 ID 时自动更新关联的 order_id
);
```

级联操作的几种策略：

| 策略 | 行为 | 适用场景 |
|------|------|---------|
| `ON DELETE CASCADE` | 父行删除 → 子行自动删除 | 订单-订单项（订单没了，其下的商品行也没意义） |
| `ON DELETE SET NULL` | 父行删除 → 子行的外键列设为 NULL | 作者-文章（作者删号但文章保留，作者列标为匿名） |
| `ON DELETE RESTRICT` | 如果有子行存在则禁止删除父行 | 部门-员工（还有员工的部门不能删） |
| `ON DELETE SET DEFAULT` | 父行删除 → 子行的外键列设为默认值 | 分类-产品（分类删除后产品归入"未分类"） |
| `ON DELETE NO ACTION` | 与 RESTRICT 类似但检查时机不同 | 默认行为 |

> **经典源码学习**：SQLite 的外键实现是纯软件层的（不像 PostgreSQL/MySQL 使用 B+Tree 索引直接关联）。SQLite 在每次 INSERT/UPDATE/DELETE 时触发外键检查逻辑。核心实现见 `sqlite3.c` 中的 `fkTriggerHandler()` 和 `fkLookupParent()` 函数。理解这些函数后你会发现：外键在 SQLite 中本质上是一组自动生成的触发器（trigger），在 DML 操作前后执行检查。

### 1.3 什么时候不需要外键？

外键不是银弹。它的代价是：
- 每次 INSERT/UPDATE/DELETE 都要做引用检查 → 性能开销
- 级联操作可能在意料之外大规模删除数据
- 跨数据库分片（sharding）场景下外键无法工作

MoeFocus 不用外键是合理的：
- `focus_sessions` 和 `diary_entries` 的生命周期不完全耦合
- 应用层的级联逻辑更灵活（有时要删、有时不删）

**但不意味着可以忽视关联数据**——应用层需要自己管理级联逻辑。

### 1.4 应用层级联 vs 数据库层级联

```
数据库层级联：
  DELETE FROM diary_entries WHERE date = '2026-06-01';
  → 外键 ON DELETE CASCADE 自动触发
  → DELETE FROM focus_sessions WHERE date = '2026-06-01';
  → 自动的、原子的、不可分割的

应用层级联：
  // Step 1: 手动删除关联数据
  db.run('DELETE FROM focus_sessions WHERE date = ?', [date])
  // Step 2: 手动删除主数据
  db.run('DELETE FROM diary_entries WHERE date = ?', [date])
  // Step 3: 手动清理磁盘文件
  fs.unlinkSync(`sums/${date}.md`)
  → 手动的、可自定义的、需要开发者保证一致性
```

应用层级联的优势：
- 可以做非标准逻辑（如"只删 focus_sessions，不动 todo_items"）
- 可以返回详细的反馈信息（deleted_sessions: 3, cleaned_files: 1）
- 不依赖特定数据库的外键特性

劣势：如果忘记写级联逻辑，就会出现本文描述的 bug — 数据不一致。

### 1.5 SQLite 的 changes() 函数

`SELECT changes()` 是 SQLite 的内置函数，返回上一条 INSERT/UPDATE/DELETE 语句实际影响的行数：

```sql
DELETE FROM focus_sessions WHERE date = '2026-06-01';
SELECT changes();  -- 返回 3（表示删除了 3 行）
```

这对前端反馈非常有用——可以告诉用户"已清理 X 条专注数据"。

---

## 二、根因分析

旧 `diary:deleteEntry` 只做了一件事：

```sql
DELETE FROM diary_entries WHERE date = ?
```

它没有：
1. 删除同日期 `focus_sessions` 中的记录
2. 删除磁盘上的 `sums/YYYY-MM-DD.md` 文件

统计查询直接读 `focus_sessions` 表，与 `diary_entries` 无关：

```sql
-- 统计查询只看 focus_sessions，不看 diary_entries
SELECT date, SUM(actual_duration_sec) FROM focus_sessions
WHERE status = 'completed'
GROUP BY date
```

所以删除日记 = 从 `diary_entries` 删了一行 = 对统计查询零影响 = 图表不变。

---

## 三、修复方案

### diary:deleteEntry 完整流程

```
1. DELETE FROM focus_sessions WHERE date = ?    → 清理专注数据
2. SELECT changes()                              → 记录删了多少条（反馈给用户）
3. DELETE FROM diary_entries WHERE date = ?      → 删除日记条目
4. fs.unlinkSync(sums/YYYY-MM-DD.md)             → 清理磁盘文件
5. 返回 { success: true, deleted_sessions: N }   → 用户看到结果
```

**为什么不动 todo_items？**

待办事项的生命周期独立于日记和专注会话。删除日记只表示"我不想看这天的日记了"，不表示"这天的待办事项也不存在了"。

### stats:syncCleanup 孤儿数据清理

处理历史残留（早期删除日记时 focus_sessions 没有被级联清除）：

```sql
DELETE FROM focus_sessions
WHERE date NOT IN (SELECT DISTINCT date FROM diary_entries)
```

这是一个**子查询（Subquery）**模式。内层查询先找出所有存在日记的日期，外层查询删除不在这个集合中的专注会话。

### refresh_trigger 模式

子组件用 `refresh_trigger` prop 替代 `key` 强制重挂载：

```tsx
// ✓ refresh_trigger: 组件不销毁重建，只重新拉取数据
<WeeklyChart refresh_trigger={tick} />

// useEffect 内部：
useEffect(() => {
  fetch_data()
}, [refresh_trigger])  // trigger 变化 → 重新拉取数据

// vs

// ❌ key 强制重挂载：组件销毁 → 重建 → 闪烁
<WeeklyChart key={tick} />
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| 隐式关系 vs 外键 | 共享列名 ≠ 数据库知道它们有关系。隐式关系需要应用层维护一致性 |
| 外键级联策略 | CASCADE / SET NULL / RESTRICT / NO ACTION — 选哪种取决于业务语义 |
| 应用层级联 | 灵活但需手动实现，忘记任何一个步骤都会造成数据不一致 |
| changes() | SQLite 内置函数，返回上条 DML 影响的行数 — 适合做 UI 反馈 |
| refresh_trigger | 比 key 重挂载更平滑的刷新方式 |
| 子查询清理 | `WHERE col NOT IN (SELECT ...)` 是清理孤儿数据的标准 SQL 模式 |

---

## 五、项目作业：设计一个博客系统的数据删除策略

### 作业目标

设计并实现一个博客系统的数据模型和级联删除策略。

### 数据模型

```
users (用户表)
  id, username, email

posts (文章表)
  id, author_id (FK → users.id), title, content, created_at

comments (评论表)
  id, post_id (FK → posts.id), user_id (FK → users.id), content, created_at

tags (标签表)
  id, name

post_tags (文章-标签关联表)
  post_id (FK → posts.id), tag_id (FK → tags.id)

likes (点赞表)
  id, user_id (FK → users.id), post_id (FK → posts.id)
```

### 核心要求

1. **创建表结构**：包含所有外键约束

2. **设计并实现以下删除操作的级联策略**：

| 操作 | 设计决策 | 理由 |
|------|---------|------|
| 删除用户 | 文章保留(作者设为匿名)，评论保留，点赞删除 | 内容不随用户消亡 |
| 删除文章 | 评论级联删除，标签关联删除，点赞删除 | 文章没了评论没有依附 |
| 删除标签 | 只删关联表中的记录，不删文章 | 标签是次要元数据 |

3. **实现应用层级联删除函数**：

```typescript
async function delete_user(db: Database, user_id: number): Promise<DeleteResult> {
  // 1. 将该用户的文章作者标记为匿名
  // 2. 删除该用户的所有点赞
  // 3. 将评论 user_id 设为 NULL（保留评论内容）
  // 4. 删除用户
  // 返回每步影响的行数
}

async function delete_post(db: Database, post_id: number): Promise<DeleteResult> {
  // 1. 删除所有评论 (CASCADE)
  // 2. 删除所有点赞 (CASCADE)
  // 3. 删除 post_tags 关联
  // 4. 删除文章本身
}
```

### 验收标准

- [ ] 删除文章后，其评论从评论表中完全消失
- [ ] 删除用户后，其文章保留但作者显示为"已注销用户"
- [ ] 删除操作返回详细的影响行数（删了 X 篇文章、Y 条评论、Z 个点赞）
- [ ] 如果某步操作失败，前面的操作能回滚（使用事务！）

### 思考题

1. 如果 `delete_post` 删除一篇有 5000 条评论的爆款文章，一次 DELETE 5000 行会有什么性能问题？怎么优化？
2. 软删除（标记 `deleted_at` 时间戳，不真删数据）和硬删除（真删除）的优劣势分别是什么？
3. 在微服务架构中，用户服务删除了一个用户，文章服务和评论服务怎么感知到这个事件？（提示：消息队列、事件溯源）

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `electron/ipc/index.ts` | diary:deleteEntry 级联删除 + 新增 stats:syncCleanup |
| `electron/preload.ts` | 新增 stats.sync_cleanup() |
| `src/types/electron.d.ts` | 新增 BreakdownRow 和 sync_cleanup 类型声明 |
| `src/components/stats/StatsDashboard.tsx` | 同步按钮 + refresh_trigger |
| `WeeklyChart.tsx / MonthlyChart.tsx / FocusBreakdown.tsx` | refresh_trigger prop |
