# 14: 跨 PC 统计数据同步 —— focus_sessions JSON 导出/合并/导入

## 问题

即使 `sums/*.md` 日记文件正确同步，统计数据（周/月图表、每日计时环）仍只显示本机数据。因为统计图表查询的是 `focus_sessions` SQLite 表，而该表是本地私有的（`.gitignore` 排除 `*.db`），从未在 PC 间同步。

## 根因

数据流向是单向的：`focus_sessions (SQLite)` → `DiaryService.generate()` → `sums/*.md` → `git push`。同步只传输末端的 `.md` 输出，源数据 `focus_sessions` 从未传播到其他 PC。

这意味着即使 PC2 拉取了 PC1 的日记文件，PC2 的本地统计也不会包含 PC1 的会话数据。

## 思维出发点

要在 PC 间共享统计数据，需要**双向数据流**：

```
PC1 focus_sessions → JSON → git push → PC2 git pull → JSON → PC2 focus_sessions
PC2 focus_sessions → JSON → git push → PC1 git pull → JSON → PC1 focus_sessions
```

核心挑战是**去重**：同一会话不能因为在两台 PC 间来回同步而被重复计数。解决方案是为每条会话分配**全局唯一标识符 (UUID)**，合并时按 UUID 取并集。

## 修复方案

### 1. 全局会话标识 (UUID)

- `focus_sessions` 新增 `uuid TEXT UNIQUE` 列
- 每次 `focus:start` 自动生成 UUID（`crypto.randomUUID()`）
- 数据库迁移自动给历史会话补充 UUID

### 2. JSON 导出 (`export_sessions_from_db`)

同步前将所有 completed 会话导出为 `data/focus_sessions.json`：
```json
{
  "uuid-1": { "subject": "数学", "actual_duration_sec": 1500, ... },
  "uuid-2": { "subject": "英语", "actual_duration_sec": 900, ... }
}
```

以 UUID 为 key 的对象结构天然支持无冲突合并。

### 3. Git 文件级合并

`GitService.sync()` 在合并 `data/` 目录时，对 `focus_sessions.json` 执行 UUID 对象浅合并：
```typescript
const merged = { ...remote_obj, ...local_obj }
```
本地同 UUID 覆盖远程（理论上不应该发生，UUID 全局唯一）。

### 4. JSON 导入 (`import_sessions_to_db`)

同步完成后读取合并后的 JSON，逐条 `INSERT OR IGNORE`：
- UUID 已存在 → `IGNORE`（UNIQUE 约束冲突 → 跳过）
- UUID 不存在 → 插入新行，导入计数 +1

### 5. 日记重建

若导入了新会话（`imported > 0`），自动调用 `DiaryService.generate(today)` 重建当日日记，确保日记内容反映最新的会话总数。

## 完整同步流程

```
用户点击「一键同步」
  → export_sessions_from_db()    写入 data/focus_sessions.json
  → git fetch origin             获取远程引用
  → git ls-tree + git show       逐文件读取远程内容
  → 逐文件 merge                 日记 .md 语义合并 + JSON UUID 合并
  → git add + commit + push      推送合并结果
  → import_sessions_to_db()      导入远程新 UUID 的会话
  → DiaryService.generate()      重建今日日记（如果导入了新数据）
```

## 关键决策

- **只同步 completed 会话**：running 状态的会话数据不完整，同步无意义
- **UUID 进 JSON 不进 .md**：日记 markdown 保持人类可读，JSON 负责机器间数据交换
- **`INSERT OR IGNORE` 而非 `INSERT OR REPLACE`**：保留本地首次写入的会话数据不变（UUID 唯一，不会有冲突）
- **导入后重建日记**：确保 `sums/*.md` 反映合并后的准确总数

## 涉及文件

| 文件 | 改动 |
|------|------|
| `electron/database/schema.sql` | focus_sessions 新增 uuid TEXT UNIQUE |
| `electron/services/DatabaseService.ts` | 迁移：添加 uuid 列 + 历史数据补充 UUID |
| `electron/services/SyncService.ts` | 新增 export/import_sessions 函数 + SyncResult 增加 imported_sessions |
| `electron/services/GitService.ts` | sync() 合并 data/ 目录 JSON 文件 |
| `electron/ipc/index.ts` | focus:start 生成 UUID；git:sync 编排 export→sync→import→rebuild |
| `src/types/electron.d.ts` | SyncResult 增加 imported_sessions 字段 |
