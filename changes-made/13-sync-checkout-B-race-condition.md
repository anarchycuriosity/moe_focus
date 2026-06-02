# 13 — Git 对象模型与并发问题：同步为何静默失败

## 问题现象

用户在 PC① 记录专注并同步后，在 PC② 点击「一键同步」，6月1号的数据完全没有同步过来。更致命的是，同步返回 `success: true`，用户以为成功了，实际上什么都没发生。

## 一、前置知识

### 1.1 Git 的数据模型：三棵树

理解 Git，首先要理解它有三棵"树"（三个文件状态快照）：

```
┌─────────────┐    git add    ┌─────────────┐   git commit   ┌─────────────┐
│  工作目录     │ ───────────→ │   暂存区     │ ────────────→ │   仓库       │
│ (Working     │              │  (Staging    │               │ (Repository │
│  Directory)  │              │   Area/Index)│               │  /.git)     │
├─────────────┤              ├─────────────┤               ├─────────────┤
│ 你正在编辑的  │              │ 你选择要提交  │               │ 已提交的历史  │
│ 文件         │              │ 的文件       │               │ 记录         │
│             │              │             │               │             │
│ sums/6-1.md │              │ sums/6-1.md │               │ commit abc  │
│ (已修改)    │              │ (已暂存)    │               │ commit def  │
└─────────────┘              └─────────────┘               └─────────────┘

还有两个特殊的"树"：
┌─────────────┐              ┌─────────────┐
│  远程跟踪分支 │              │   HEAD      │
│ (Remote     │              │ (当前分支    │
│  Tracking)  │              │  指针)       │
├─────────────┤              ├─────────────┤
│ origin/main │              │ refs/heads/ │
│ 指向远程仓库 │              │ main        │
│ 的最新提交   │              │ 指向当前    │
│             │              │ checkout 的 │
│             │              │ 分支最新提交  │
└─────────────┘              └─────────────┘
```

**理解这个模型是操作 Git 的前提**。每个 Git 命令本质上是在操纵这些"树"之间的数据流。

> **经典源码学习**：Git 的底层实现极其简洁。整个 Git 本质上是一个**内容寻址的文件系统**（Content-addressable Filesystem）。`.git/objects/` 目录下存储了所有对象（blob/tree/commit/tag），用 SHA-1 哈希值作为文件名。Git 的 `cat-file` 命令可以查看任意对象的原始内容。推荐阅读 Git 源码的 `object.c` 和 `read-cache.c`（暂存区/索引的实现），每个文件只有 ~3000 行，非常易读。

### 1.2 checkout 和 checkout -B 的区别

```bash
# 普通 checkout：切换分支
git checkout main
# 做了什么：
# 1. 将 HEAD 指针从当前分支移到 main
# 2. 将工作目录的文件更新为 main 分支最新提交的内容
# 3. 如果工作区有未提交的修改，且修改的文件在 main 分支上内容不同 → 拒绝切换！

# checkout -B：强制创建/重置分支
git checkout -B main origin/main
# 等价于：
#   git branch -f main origin/main   # 强制将 main 分支指针移到 origin/main 的位置
#   git checkout main                # 切换到 main(即 origin/main 的内容)
# 同样，如果工作区有未提交修改的追踪文件 → 同样会拒绝切换！
```

**关键陷阱**：`checkout -B` 虽然有 `-B`（强制）标志，但它只强制"覆盖分支指针"，**不强制覆盖工作区的脏文件**。Git 永远不会静默覆盖你的未提交修改。

### 1.3 为什么 MoeFocus 的同步场景中工作区有脏文件？

```
正常同步流程：
  1. 用户点击「一键同步」
  2. SchedulerService 刚好在后台触发了日记生成
     → DiaryService.generate() 更新了 sums/2026-06-01.md
  3. 这个文件在上一次 sync 中已经被 git add + commit
     → 它是"已追踪文件"
  4. DiaryService 的更新让它变成了"脏文件"（已修改但未暂存）
  5. 此时 sync() 执行 checkout -B origin/main
     → Git 检测到 sums/2026-06-01.md 有未提交修改
     → 拒绝 checkout！
  6. catch 块静默吞掉错误
     → remote_has_branch 保持 false
     → 后续 merge 变成 local vs local 的 no-op
     → 返回 success: true ← 用户完全不知道同步失败了
```

这是一个经典的**竞态条件（Race Condition）**：两个独立的事件（用户手动同步 + 后台自动生成日记）在同一时刻竞争同一资源（工作区文件状态）。

### 1.4 git show：不修改工作区也能读取任何提交的内容

`git show` 的威力在于它直接读取 `.git/objects/` 中的对象，完全不触碰工作区：

```bash
# 读取远程分支上某个文件的内容（无需 checkout！）
git show origin/main:sums/2026-06-01.md

# 读取远程分支上某个目录中的所有文件
git ls-tree -r --name-only origin/main:sums/
# 输出: 2026-06-01.md
#       2026-06-02.md

# 逐文件读取
git show origin/main:sums/2026-06-01.md
git show origin/main:sums/2026-06-02.md
```

这完美解决了"脏文件阻塞 checkout"的问题——我们永远不需要切换工作区，只需要读取远程文件的内容。

**新 sync 流程**：

```
旧（有 bug）: fetch → checkout -B → merge → commit → push
              └── 脏文件阻塞在这里

新（修复后）: fetch → ls-remote (检查远程分支是否存在)
                  → ls-tree (列出远程文件)
                  → git show (逐文件读取远程内容，不触碰工作区)
                  → 内存中 merge (读本地文件 + 读远程内容 → 合并)
                  → 写入合并结果
                  → add + commit + push
```

> **经典源码学习**：Git 的 `show` 命令实现在 `builtin/log.c` 中（约 2000 行）。它的核心逻辑是：解析 `<rev>:<path>` 语法 → 通过 `get_oid()` 将引用解析为对象 SHA-1 → 用 `read_object()` 从 `.git/objects/` 读取对象内容 → 输出。整个过程完全不涉及工作区或暂存区的修改。这就是为什么 `git show` 在任何工作区状态下都能正常工作。

### 1.5 静默吞错的危害

```typescript
// ❌ 反模式：catch 块什么都不做
try {
  await g.raw(['checkout', '-B', target, `origin/${target}`])
} catch {
  // 静默吞掉错误
  // 开发者不知道 checkout 失败了
  // 用户不知道同步没有发生
  // 数据静默丢失
}

// ✓ 至少记录错误
try {
  await g.raw(['checkout', '-B', target, `origin/${target}`])
} catch (e) {
  console.error('[sync] checkout failed:', e)  // 开发者能在日志中看到
  result.error = '分支对齐失败: ' + String(e)   // 用户能在 UI 看到
  return result                                 // 不要让流程继续
}
```

---

## 二、根因分析

### 核心问题：checkout -B 在脏文件场景下失败 + 错误被吞掉

```
旧 sync() 流程:
  ① fetch origin
  ② checkout -B main origin/main    ← 这里失败（工作区有脏文件）
  ③ catch 块什么都不做               ← 错误被吞
  ④ remote_has_branch = false       ← 永远走不到远程分支存在的逻辑
  ⑤ 后续 merge 是 local vs local     ← no-op
  ⑥ 返回 success: true              ← 用户以为成功了
```

### 新的无 checkout 方案

```
新 sync() 流程:
  ① fetch origin
  ② git ls-remote origin main                     ← 不碰工作区，只判断远程分支存在
  ③ 快照本地文件到内存 Map                          ← 读本地文件
  ④ git ls-tree + git show 逐文件读取远程内容        ← 不碰工作区，读远程文件
  ⑤ 在内存中 merge 本地 + 远程                      ← 计算合并结果
  ⑥ 写入合并结果到工作区                             ← 唯一修改工作区的步骤
  ⑦ add + commit + push
```

---

## 三、修复方案

核心代码思路（简化版）：

```typescript
// 替代 checkout -B 的完整逻辑

// 1. 检查远程分支是否存在（不碰工作区）
const refs = await git.raw(['ls-remote', 'origin', branch])
const remote_exists = refs.trim().length > 0

// 2. 快照本地文件
const local_files = new Map<string, string>()
for (const f of readdirSync(sums_dir)) {
  if (f.endsWith('.md')) {
    local_files.set(f, readFileSync(join(sums_dir, f), 'utf-8'))
  }
}

// 3. 逐文件从远程读取（不 checkout）
const remote_files = new Map<string, string>()
if (remote_exists) {
  const list = await git.raw(['ls-tree', '-r', '--name-only', `origin/${branch}:sums/`])
  for (const f of list.split('\n').filter(Boolean)) {
    const content = await git.show([`origin/${branch}:sums/${f}`])
    remote_files.set(f, content)
  }
}

// 4. 内存中合并
for (const filename of union(local_files.keys(), remote_files.keys())) {
  const local = local_files.get(filename)
  const remote = remote_files.get(filename)
  
  if (local && remote) {
    // 两边都有 → 语义合并
    writeFileSync(join(sums_dir, filename), merge_diaries(local, remote))
  } else if (remote && !local) {
    // 只在远程有 → 直接写入
    writeFileSync(join(sums_dir, filename), remote)
  }
  // 只在本地有 → 保持不动（推送时自然会上去）
}
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| Git 三棵树 | 工作区 → 暂存区 → 仓库。每个 git 命令都是在这三棵树之间搬数据 |
| checkout -B 不强制覆盖脏文件 | Git 永远不会静默丢弃你的未提交修改 |
| 竞态条件 | 定时任务刷新文件 + 用户触发的同步同时运行 → 工作区有脏文件 → checkout 失败 |
| git show 不碰工作区 | 直接从 `.git/objects/` 读取任意提交的内容，脏文件不影响它 |
| 静默吞错的危害 | catch 块必须记录日志或返回错误。用户看到 `success: true` 但什么都没发生 = 最危险的状态 |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `electron/services/GitService.ts` | sync() 方法完全重写：去除 checkout -B，改用 git show |
