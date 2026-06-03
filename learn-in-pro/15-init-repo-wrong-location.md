# 15 — Git 仓库初始化与 API 语义：为什么同步完全无效

## 问题现象

这是跨 PC 同步完全失败的根本原因。用户在两台 PC 上都配置了同步，点击「一键同步」返回 `success: true`，但另一台 PC 上永远看不到对方的数据。经排查发现：`%APPDATA%/moefocus/` 目录下根本没有 `.git` 文件夹。

## 一、前置知识

### 1.1 `.git` 目录：Git 仓库的心脏

一个 Git 仓库本质上就是一个包含 `.git` 目录的普通文件夹。`.git` 目录中存储了：

```
.git/
├── HEAD              # 指向当前 checkout 的分支
├── config            # 仓库级别的 Git 配置（如 remote url）
├── objects/          # 所有对象：commit、tree、blob（文件内容）
│   ├── 00/
│   ├── 0a/
│   └── ...
├── refs/
│   ├── heads/        # 本地分支指针（如 main、master）
│   │   ├── main
│   │   └── master
│   ├── remotes/      # 远程跟踪分支指针（如 origin/main）
│   │   └── origin/
│   └── tags/         # 标签
├── index             # 暂存区
└── logs/             # reflog（操作历史）
```

没有 `.git` 目录 = 没有 Git 仓库 = 所有 Git 操作（add/commit/push/pull）都不可能在这个目录下执行。

### 1.2 git init：创建 .git 目录

```bash
git init
# 在当前目录创建 .git/ 文件夹
# 初始化 HEAD（指向 refs/heads/master 或 main）
# 初始化 config
# 此时仓库是空的 — 没有任何 commit

git init --initial-branch=main
# 同上，但将默认分支名设为 main（而非 master）
# 2020 年 GitHub 将默认分支名从 master 改为 main
```

`git init` 只在**当前目录**创建 `.git`。它是非递归的——不会在父目录或子目录创建仓库。

### 1.3 checkIsRepo()：集合包含检测 vs 精确匹配

这是整个 bug 的核心。`simple-git` 的 `checkIsRepo()` 实现了"检测当前目录是否在某个 Git 仓库的管辖范围内"：

```javascript
// simple-git 的 checkIsRepo() 等价于：
git rev-parse --show-toplevel
// 这个命令从当前目录开始，逐级向上查找 .git 目录
// 直到找到一个包含 .git 的目录，返回该目录的路径
// 如果到了文件系统根目录还没找到，才返回错误

// 例如:
// 当前目录: C:\Users\curiosity\AppData\Roaming\moefocus\
//           (没有 .git)
//
// git rev-parse --show-toplevel 向上查找:
//   moefocus/         → 没有 .git
//   Roaming/          → 没有 .git
//   AppData/          → 没有 .git
//   curiosity/        → 有 .git！← 找到了！返回 C:\Users\curiosity\
//   (不再继续向上)
```

**这意味着**：如果用户主目录 `C:\Users\curiosity\` 下有 `.git`（可能是误操作用 `git init` 创建的，或是某个工具的副作用），那么 `checkIsRepo()` 在 `moefocus/` 目录下调用会返回 `true`——但 `moefocus/` 本身不是 Git 仓库！

**两种语义的本质区别**：

```
精确匹配（我们想要的）:
  "这个目录本身是 Git 仓库吗？"
  即: existsSync(join(dir, '.git')) === true
  作用: 判断是否需要在当前目录执行 git init

集合包含（checkIsRepo 提供的）:
  "这个目录在某个 Git 仓库的管辖范围内吗？"
  即: 向上查找到任意一个 .git 目录
  作用: 判断当前环境能否执行 Git 命令（如 git log）
```

> **经典源码学习**：Git 源码中 `setup.c` 的 `setup_git_directory_gently()` 函数（约 400 行）实现了这个向上递归查找的逻辑。它通过检查目录中是否存在 `.git`（或 `.git` 文件指向的 worktree）来确定仓库根目录。函数的返回值是仓库根目录的绝对路径，如果没找到则返回 NULL。

### 1.4 连锁反应：整个同步系统是如何彻底失效的

```
用户启动 MoeFocus
  │
  ├─ main.ts: git_service.init_repo()
  │   调用 simpleGit('C:/Users/.../moefocus/')
  │   调用 checkIsRepo()
  │   → 向上递归查找
  │   → 在 C:/Users/curiosity/ 找到 .git
  │   → 返回 true
  │   → 跳过 git init ← 不在 moefocus/ 下创建 .git
  │
  ├─ 用户点击「一键同步」
  │   git_service.sync()
  │   调用 simpleGit('C:/Users/.../moefocus/')
  │   但 simple-git 内部也会向上查找仓库根目录
  │   → 找到 C:/Users/curiosity/
  │   → git add sums/  ← 把 C:/Users/curiosity/sums/ 加入暂存区
  │                      （如果这个路径不存在，就是空操作）
  │   → git commit      ← 在 C:/Users/curiosity/ 的仓库中提交
  │   → git push        ← 推送 C:/Users/curiosity/ 的内容
  │
  └─ 结果:
      moefocus/sums/2026-06-01.md ← 从未被版本控制
      远程仓库出现奇怪的路径（AppData/Roaming/moefocus/.gitignore）
      两台 PC 各在不同的仓库中操作，数据从未真正交换
```

**这个 bug 的隐蔽性**：所有 Git 操作都"成功"了（add/commit/push 不报错），只是它们在错误的仓库中执行。用户看到 `success: true`，完全不知道出了什么问题。

---

## 二、根因分析

```typescript
// ❌ 旧代码
async init_repo(): Promise<{ success: boolean }> {
  const g = await this.get_git()  // simpleGit(moefocus_path)
  const is_repo = await g.checkIsRepo()  // 向上递归查找！
  
  if (!is_repo) {
    await g.init()  // 这行永远不会执行（因为父目录有 .git）
  }
  return { success: true }
}
```

**修复**：

```typescript
// ✓ 新代码
import { existsSync } from 'fs'
import { join } from 'path'

async init_repo(): Promise<{ success: boolean }> {
  const g = await this.get_git()
  const git_dir = join(this.repo_path, '.git')  // 精确路径
  
  if (!existsSync(git_dir)) {       // 直接检查，不递归
    await g.raw(['init', '--initial-branch=main'])  // 显式指定分支名
  }
  
  this.ensure_gitignore()
  return { success: true }
}
```

**fix 的关键**：
1. 用 `existsSync(join(repo_path, '.git'))` 替代 `g.checkIsRepo()` — 精确匹配 vs 集合包含
2. `--initial-branch=main` 避免 `master`/`main` 分支名不匹配的后续问题
3. 同时修复了 `check_sync_status()` 中的相同问题

---

## 三、修复方案

### 1. init_repo()：精确检查 + 显式分支名

```typescript
async init_repo(): Promise<{ success: boolean; error?: string }>
{
  const g = await this.get_git()
  const git_dir = join(this.repo_path, '.git')

  if (!existsSync(git_dir))
  {
    await g.raw(['init', '--initial-branch=main'])
  }

  this.ensure_gitignore()
  return { success: true }
}
```

### 2. check_sync_status()：同样修复

```typescript
// 旧: result.is_repo = await g.checkIsRepo()
// 新:
result.is_repo = existsSync(join(this.repo_path, '.git'))
```

### 3. sync()：分支名对齐

处理旧仓库可能使用 `master` 而非 `main` 的情况：

```typescript
// 检测当前分支名
const head = await g.raw(['rev-parse', '--abbrev-ref', 'HEAD'])
const current = head.trim()

// 如果不匹配且不在 detached HEAD 状态 → 重命名
if (current !== 'HEAD' && current !== target)
{
  await g.raw(['branch', '-m', current, target])
}
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| .git 目录 | Git 仓库 = 一个包含 .git 子目录的普通文件夹。没有 .git 就没有仓库 |
| 精确匹配 vs 集合包含 | `existsSync(join(dir, '.git'))` ≠ `checkIsRepo()`。后者向上递归 |
| API 语义陷阱 | `checkIsRepo()` 的名字暗示它检测"当前目录是不是仓库"，但实际是"在不在某个仓库里" |
| 父目录 .git 的隐患 | 任何祖先目录的 .git 都会导致 `checkIsRepo()` 返回 true |
| 静默错误链 | 所有 Git 操作在错误的仓库中执行且不报错 → 用户完全感知不到问题 |
| --initial-branch | 显式设置默认分支名，避免 master/main 不匹配 |

---

## 五、项目作业：构建一个多节点数据同步系统（覆盖 13/14/15）

### 作业目标

用 Node.js + Git 实现一个简化版的多节点数据同步系统，覆盖 Git 操作、UUID 去重、冲突合并等核心知识点。

### 项目概述

构建一个「分布式笔记同步系统」：两台"节点"（用两个不同的本地目录模拟）各自可以创建笔记，通过一个共享的 bare Git 仓库进行同步。

```
目录结构:
  /tmp/sync-demo/
  ├── shared-repo.git/     # bare 仓库（模拟 GitHub）
  ├── node-a/              # 节点 A（模拟 PC①）
  │   ├── notes/           # 笔记文件
  │   └── data/            # JSON 数据
  └── node-b/              # 节点 B（模拟 PC②）
      ├── notes/
      └── data/
```

### 核心要求

1. **仓库初始化**：
   - 在 `shared-repo.git/` 创建 bare 仓库
   - 在 `node-a/` 和 `node-b/` 分别初始化 Git 仓库并关联到 shared-repo
   - **必须验证** `.git` 目录是否创建在正确位置

2. **笔记系统**：
   - 每条笔记有一个 UUID
   - 笔记内容为 JSON：`{ uuid, title, content, created_at, updated_at }`
   - 支持创建、编辑、删除笔记

3. **同步系统**：
   ```
   导出本地笔记 → JSON (UUID-keyed)
     → git fetch shared-repo
     → git show 读取远程版本
     → 合并: { ...remote, ...local } (UUID 天然去重)
     → 写入合并结果
     → git add + git commit + git push
   ```

4. **冲突场景测试**：
   - 节点 A 创建笔记1，节点 B 创建笔记2，同步后两边都有笔记1+笔记2
   - 节点 A 修改笔记1 的标题，节点 B 修改笔记1 的内容，同步后标题和内容都是最新的
   - **注意**：简单的 `{ ...remote, ...local }` 会丢失一方修改。需要更深层的合并策略

5. **实现 git show 读取远程文件**（不 checkout）：

```typescript
// 读取远程仓库文件的核心函数
async function read_remote_file(
  git: SimpleGit, remote_name: string, branch: string, file_path: string
): Promise<string | null>
{
  try {
    return await git.show([`${remote_name}/${branch}:${file_path}`])
  } catch {
    return null  // 文件在远程不存在
  }
}

// 列出远程目录
async function list_remote_dir(
  git: SimpleGit, remote_name: string, branch: string, dir: string
): Promise<string[]>
{
  const output = await git.raw([
    'ls-tree', '-r', '--name-only', `${remote_name}/${branch}:${dir}/`
  ])
  return output.split('\n').filter(Boolean)
}
```

### 验收标准

- [ ] 在两个节点独立创建笔记后，同步后两个节点都有对方的笔记
- [ ] 同一笔记在两节点被修改后，同步时能检测冲突并提示用户
- [ ] 重复同步（点多次同步按钮）不会产生重复数据（幂等性）
- [ ] 删除一个节点的 `.git` 后运行初始化，`.git` 被正确重建
- [ ] `git show` 读取远程文件的过程不依赖 checkout（工作区有脏文件也能正常工作）

### 思考题

1. 如果共享仓库在 GitHub 上而你的程序在客户端运行，多个客户端同时 `git push` 会出现什么问题？Git 如何处理这种冲突？
2. UUID 的 `{ ...remote, ...local }` 合并策略在笔记被删除的场景下有什么问题？（提示：A 删除了笔记，B 修改了同一笔记，同步后笔记复活了）
3. 如果要支持离线编辑（两台 PC 同时离线各产生 10 条笔记，然后分别上线同步），当前方案有什么问题？

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `electron/services/GitService.ts` | init_repo() + check_sync_status() + 分支名对齐 |
