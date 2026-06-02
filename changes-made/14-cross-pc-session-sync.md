# 14 — 分布式数据同步：UUID 去重与 JSON 导出/合并/导入

## 问题现象

即使 13 号文档修复了 Git 同步流程，日记文件（`sums/*.md`）可以在 PC 间正确同步，但统计图表仍然只显示本机数据。PC① 记了 5 小时数学，PC② 记了 3 小时英语，同步后 PC② 应该显示总共 8 小时——但实际只显示 3 小时。

## 一、前置知识

### 1.1 源数据 vs 派生数据：同步链条中最容易被忽视的区别

这是整个同步系统设计中最核心的概念区分：

```
源数据 (Source of Truth)
  focus_sessions 表 (SQLite)
  │ 每一行 = 一次专注会话的完整记录
  │ 包含: 开始时间、结束时间、实际时长、事项名称、UUID
  │
  │  DiaryService.generate()  派生过程
  ▼
派生数据 (Derived Data)
  sums/2026-06-01.md (Markdown 文件)
  │ 从源数据计算得出
  │ 包含: 总专注时间、事项时间分布、会话数
  │ 是"快照"而非"真相"
```

**关键认知**：同步派生数据 ≠ 同步源数据。

```
错误的同步策略:
  PC① focus_sessions → sums/*.md → git push → PC② git pull → sums/*.md
  PC② 的统计图表查询的是 PC② 的 focus_sessions 表
  → 同步了 sums，但没有更新 PC② 的源数据
  → 统计图表不变 ✗

正确的同步策略:
  PC① focus_sessions → data/focus_sessions.json → git push
  → PC② git pull → data/focus_sessions.json → INSERT INTO PC②.focus_sessions
  → PC② 的统计图表查询 PC② 的 focus_sessions 表（现在包含 PC① 的数据了）
  → 统计图表正确 ✓
```

**类比**：你有一本账本（源数据：focus_sessions），每月生成一份财务报表（派生数据：sums/*.md）。把报表传真给另一个办公室不意味着他们的账本也更新了——他们需要在账本上逐笔记账（导入源数据）。

### 1.2 UUID：分布式系统中去重的基石

UUID（Universally Unique Identifier，通用唯一标识符）是一个 128 位的数字，其值在空间和时间上被认为是唯一的。

```
格式: 550e8400-e29b-41d4-a716-446655440000
       └────┬────┘ └─┬─┘ └─┬─┘ └─┬─┘ └────┬────┘
       时间戳    版本   变体  序列号   节点ID (MAC地址)
```

**为什么需要 UUID？**

两台 PC 独立产生数据，它们的自增 ID（`INTEGER PRIMARY KEY AUTOINCREMENT`）会冲突：

```
PC①: id=1 (数学 2h)  id=2 (英语 1h)  id=3 (编程 3h)
PC②: id=1 (英语 1h)  id=2 (数学 1h)  id=3 (日语 2h)

合并后如果用 id 去重:
  id=1: 是数学还是英语？   ← 冲突！无法区分
  id=2: 是英语还是数学？   ← 冲突！
  id=3: 是编程还是日语？   ← 冲突！
```

使用 UUID 后：

```
PC①: uuid=aaa... (数学 2h)  uuid=bbb... (英语 1h)  uuid=ccc... (编程 3h)
PC②: uuid=ddd... (英语 1h)  uuid=eee... (数学 1h)  uuid=fff... (日语 2h)

合并后: 6 条记录，UUID 各不同，完全不冲突 ✓
```

**UUID 的生成**：

```javascript
// Node.js (主进程)
const { randomUUID } = require('crypto')
const id = randomUUID()  // '550e8400-e29b-41d4-a716-446655440000'

// 浏览器 (渲染进程)
const id = crypto.randomUUID()  // Web Crypto API，所有现代浏览器都支持
```

> **经典源码学习**：UUID v4 的生成算法极其简洁——本质上是生成 122 位随机数 + 6 位固定标记位。Node.js 的 `randomUUID` 实现在 `lib/internal/crypto/random.js` 中，核心代码约 30 行。它调用操作系统的 CSPRNG（Cryptographically Secure Pseudo-Random Number Generator）来生成真正的随机字节。

### 1.3 以 UUID 为 Key 的 JSON 对象：天然无冲突的数据结构

```json
// data/focus_sessions.json
{
  "550e8400-e29b-41d4-a716-446655440000": {
    "subject": "数学",
    "actual_duration_sec": 7200,
    "status": "completed",
    "date": "2026-06-01",
    "started_at": "2026-06-01 09:00:00"
  },
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8": {
    "subject": "英语",
    "actual_duration_sec": 3600,
    "status": "completed",
    "date": "2026-06-01",
    "started_at": "2026-06-01 14:00:00"
  }
}
```

**这种结构的天才之处**：

```javascript
// 合并两台 PC 的数据 = 一个浅合并操作
const pc1_data = { "uuid-a": {...}, "uuid-b": {...} }
const pc2_data = { "uuid-c": {...}, "uuid-d": {...} }

// 合并（本地覆盖远程的同 UUID 条目——虽然理论上不应该发生）
const merged = { ...pc2_data, ...pc1_data }
// 结果: { "uuid-a": {...}, "uuid-b": {...}, "uuid-c": {...}, "uuid-d": {...} }
// 完美！无需任何冲突解决逻辑，因为 UUID 保证了键的唯一性
```

这种结构在分布式系统中被称为 **CRDT-like Merge**（Conflict-free Replicated Data Type 风格的合并）。它利用 UUID 的唯一性将"冲突检测"问题转化为"不可能冲突"问题。

### 1.4 INSERT OR IGNORE：数据库层的幂等导入

```sql
INSERT OR IGNORE INTO focus_sessions
  (uuid, subject, actual_duration_sec, ...)
VALUES
  ('uuid-a', '数学', 7200, ...),
  ('uuid-b', '英语', 3600, ...);
```

`INSERT OR IGNORE` 的行为：
- 如果 `uuid` 列的值在表中已经存在（UNIQUE 约束冲突）→ **静默跳过这一行**，不报错
- 如果 `uuid` 列的值在表中不存在 → 正常插入

这就是**幂等性**（Idempotency）：同一个导入操作执行 1 次和执行 100 次，结果完全相同。第一次导入插入了新数据，后续导入因为 UUID 已存在而全部跳过。

**为什么不是 INSERT OR REPLACE？**

```sql
-- INSERT OR REPLACE: 如果冲突 → 删除旧行 → 插入新行
-- 问题：如果远程数据是旧版本（同步时间差），会覆盖本地更新的数据

-- INSERT OR IGNORE: 如果冲突 → 什么都不做
-- 优势：保留首次写入的数据。UUID 唯一 → 第一次写入的就是"正确的"
```

### 1.5 完整同步流程的六步编排

```
用户点击「一键同步」
  │
  ├─ Step 1: export_sessions_from_db()
  │   从本地 SQLite 导出所有 completed 会话 → data/focus_sessions.json
  │   格式: { uuid: { subject, actual_duration_sec, ... } }
  │   必须在 fetch 之前！否则本地最新数据不会被包含在合并中
  │
  ├─ Step 2: git fetch origin
  │   获取远程引用（不修改本地工作区）
  │
  ├─ Step 3: git ls-tree + git show
  │   逐文件读取远程 sums/*.md 和 data/*.json 的内容
  │   不 checkout，不碰工作区
  │
  ├─ Step 4: 逐文件 merge
  │   .md 文件 → 语义合并（累计时间 + 合并事项分布）
  │   .json 文件 → UUID 浅合并（{ ...remote, ...local }）
  │   写入合并结果
  │
  ├─ Step 5: git add + git commit + git push
  │   推送合并结果到远程仓库
  │
  └─ Step 6: import_sessions_to_db()
      读取合并后的 data/focus_sessions.json
      逐条 INSERT OR IGNORE INTO local SQLite
      → 如果导入了新会话 → DiaryService.generate(today) 重建今日日记
      → sync_diary_entries_from_files() 更新 diary_entries 表
```

**步骤顺序不能乱**：Step 1 (export) 必须在 Step 2 (fetch) 之前，否则本地新产生的会话不会被包含在合并中。

---

## 二、根因分析

旧同步策略的根本缺陷在于**混淆了源数据和派生数据**：

```
旧：focus_sessions (源) → sums/*.md (派生) → git push → sums/*.md (PC②)
    问题：PC② 的统计查询读的是 PC② 的 focus_sessions 表，不是 sums/*.md
    → 同步了输出但没有同步源数据 → 统计从未反映跨 PC 数据
```

修复引入了两个关键机制：
1. **UUID + JSON 导出**：让源数据可以跨 PC 传输
2. **INSERT OR IGNORE 导入**：让源数据安全地合并到本地数据库

---

## 三、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| 源数据 vs 派生数据 | 同步派生数据不能更新源数据。多节点一致性需要双向源数据同步 |
| UUID | 全局唯一标识符，让分布式产生的数据天然不会冲突 |
| UUID-keyed JSON | `{ uuid: data }` 结构 = 天然无冲突的分布式合并 |
| INSERT OR IGNORE | 幂等导入：同样的数据导入 N 次，结果完全相同 |
| 幂等性 | 同一操作执行多次的结果与执行一次相同 = 分布式系统的黄金法则 |
| 同步步骤顺序 | export 必须在 fetch 之前 — 先保存本地数据，再拉远程数据 |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `electron/database/schema.sql` | focus_sessions 新增 uuid TEXT UNIQUE |
| `electron/services/DatabaseService.ts` | 迁移脚本：添加 uuid 列 + UNIQUE 索引 |
| `electron/services/SyncService.ts` | 新增 export/import_sessions + sync_diary_entries |
| `electron/services/GitService.ts` | sync() 处理 data/ 目录 JSON UUID 合并 |
| `electron/ipc/index.ts` | focus:start 生成 UUID；git:sync 编排六步流程 |
| `electron/main.ts` | 启动同步补全 export → sync → import 链路 |
