# 15: git 仓库初始化在错误目录 —— checkIsRepo 向上递归查找

## 问题现象

用户反馈在另一台 PC 上同步失败，6.1 号数据无法同步。经排查发现：`%APPDATA%/moefocus/` 目录下根本没有 `.git` 文件夹，git 仓库从未被创建在正确的位置。

## 根因

`init_repo()` 使用了 `simple-git` 的 `checkIsRepo()` 方法：

```typescript
const is_repo = await g.checkIsRepo()
if (!is_repo) {
  await g.init()
}
```

**`checkIsRepo()` 默认会向上递归查找 `.git` 目录**（类似 `git rev-parse --show-toplevel`），而不是仅检查当前目录。

用户的 `C:\Users\curiosity\` 目录下恰好存在一个 `.git`（来源不明，可能是误操作或某工具创建），且该仓库的 remote 恰好指向 `moe_focus_data.git`。

因此 `checkIsRepo()` 永远返回 `true` → `git init` 永远不会在 `moefocus/` 下创建 `.git` → **所有 git 操作（commit/push/pull/sync）都在用户主目录的仓库中执行**，而不是在 moefocus 数据目录中。

### 连锁反应

1. `git add sums/` 提交的是主目录下的 `sums/`（不存在或为空）
2. `git push` 推送的是主目录的所有文件（所以远程出现 `AppData/Roaming/moefocus/.gitignore` 等奇怪路径）
3. 在另一台 PC 上，moefocus/ 下同样没有 `.git`，`checkIsRepo()` 同样向上递归到某个父目录的 `.git`
4. 两台 PC 各自的 git 操作都在不同的仓库里，数据从未真正交换

## 思维出发点

**API 的默认行为往往包含隐含语义**。`checkIsRepo()` 的设计意图是 "检测当前目录是否在一个 git 仓库内"（包容性语义），而不是 "检测当前目录本身是否是 git 仓库"（精确性语义）。对于需要在特定目录执行 git 操作的场景，向上递归是危险的——它会找到意料之外的仓库。

**教训**：
- `checkIsRepo()` 不等于「当前目录有 .git」——它是集合包含检测，不是精确匹配
- 永远用 `existsSync(join(repo_path, '.git'))` 直接检查 `.git` 目录是否存在
- simple-git 初始化时的路径参数仅影响 git 命令的 `-C` 参数，不影响 `checkIsRepo()` 的递归行为
- 父目录存在 `.git` 是一个隐式陷阱——只要有任何祖先目录是 git 仓库，当前目录就会被视为"在仓库内"

## 修复

1. `init_repo()`: 用 `existsSync(join(repo_path, '.git'))` 替代 `g.checkIsRepo()`
2. `check_sync_status()`: 同样用 `existsSync` 替代 `checkIsRepo()`
3. `init_repo()`: 新增 repo 时使用 `git init --initial-branch=main` 避免 default branch 名不匹配
4. `sync()`: 新增分支名对齐步骤，处理旧仓库 `master`→`main` 重命名

## 测试验证

在 moefocus 用户数据目录手动测试：
1. 初始化 git 仓库 → 成功创建 `.git`
2. 设置 remote → 正确指向 `moe_focus_data.git`
3. 拉取远程文件 → `sums/2026-06-01.md` 正确获取
4. 创建本地新数据 → `sums/2026-06-02.md` + `data/focus_sessions.json`
5. commit + push → 成功推送到 remote
6. 从另一个空目录 clone 验证 → 所有文件正确拉取
7. `merge_diaries()` 语义合并测试 → 时间累加 + 事项合并 + 反思保留，全部正确

## 涉及文件

| 文件 | 改动 |
|------|------|
| `electron/services/GitService.ts` | init_repo() + check_sync_status() 修复 + 分支名对齐 |
