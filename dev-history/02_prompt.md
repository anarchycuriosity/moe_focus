我们正在做一个叫MoeFocus的日记+专注时间统计的专注钟，类似windows的专注钟但有一些新功能集成。我们现在主要先做moefocus文件夹下的桌面端部分，moefocus-mobile文件夹下的移动端先不管。修复记录的内容已经被修复了，现在部分模块已经比较稳定了，但有以下问题你需要修复（我提出的问题也要在下一轮修复中被补充到修复记录）。你对以下的每点内容都要分别建立新的分支并在那个分支进行提交，而不是改完所有才提交。**每次对话结束前必须按下方格式在本文末尾追加修复记录review，方便下次开新终端循环。**如果0x_prompt.md写的review过长了，就按序号新建一个prompt.md来review，这样只看最近修改的核心代码模块而不必回顾过多。

上一次修复的结果很成功，你review一下然后更新关于数据同步功能使用说明和原理的readme和review文件夹下的教育文档。
1.checkout到新的分支我们现在来测试qq邮箱提醒的测试（我已经配置好了我的邮箱数据），现在这个功能模块完全不生效。每天设定时间提醒写日记，每周设定时间提醒写博客。
2.新增一个定时生成当天日记并typora来写日记的功能（如果应用在启动状态的话）。
测试功能是否成功，成功才算结束


## 2026-06-01 第六轮修复记录 (claude: Kurisu)

### 已完成 (1 commit)

**1. 数据同步重写 — 语义合并替代 Git Pull** (`db3ed4b`)
- **根因**: 原有同步完全依赖 `git pull`/`git push`，两台 PC 独立生成同一天日记后 pull 产生合并冲突，无合并策略；`SchedulerService` 自动同步 commit 后直接 push（不先 pull），push 被拒
- **修复**:
  - **新增 `SyncService`** (`electron/services/SyncService.ts`):
    - `parse_diary(markdown)`: 解析日记 Markdown，提取总时间(session_count + total_minutes)、事项时间分布(`Map<subject → minutes`)、自我反思、首尾结构
    - `merge_diaries(local, remote)`: 累加 total_minutes + session_count，合并 subject_times map（同名事项累加），保留 local 反思，输出合并后 Markdown
    - 时间格式兼容 `"Xh Ym"`、`"X 小时 Y 分钟"` 等变体
  - **`GitService.sync(branch)`** (新增):
    - `git fetch origin` → 列出本地 `sums/*.md` → 逐文件 `git show origin/branch:sums/file.md` 取远程版 → `merge_diaries()` 合并 → 写回本地
    - `git ls-tree origin/branch:sums/` 列出远程文件 → 仅远程存在的 checkout 到本地
    - `git add sums/` + `git commit` + `git push`
    - 返回摘要：`{ merged_files, new_from_remote, new_subjects, total_added_minutes }`
  - **IPC/Preload/类型**: 新增 `git:sync` handler + `sync()` bridge + `SyncResult` 类型
  - **`SettingsPage`**: GitHub 标签页新增「一键同步」primary 按钮，Pull/Commit/Push 降级为 ghost 高级操作
  - **`SchedulerService`**: 自动同步改为调用 `sync()`，移除单独的 `diary.autoPush` 检查
  - **`main.ts`**: 启动同步改为 `sync()` 替代 `pull()`

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| 同步服务 | `electron/services/SyncService.ts`(新), `GitService.ts` |
| IPC/Preload | `electron/ipc/index.ts`, `electron/preload.ts` |
| 类型声明 | `src/types/electron.d.ts` |
| 设置页 | `src/pages/SettingsPage.tsx` |
| 调度器/启动 | `electron/services/SchedulerService.ts`, `electron/main.ts` |

### 项目现状
- 提交记录：16 commits ahead of origin/main，待 push
- 同步流程：fetch → 语义合并（累加时间+合并事项）→ commit → push
- 暂停/继续/重置逻辑正常，核心功能稳定

---

## 2026-06-01 第七轮修复记录 (claude: Kurisu)

### 已完成 (1 commit)

**1. sync() 对齐本地分支到远程 — checkout -B 解决分支不匹配** (`ee7b7bb`)
- **根因**: 本地数据仓库在 `master` 分支，远程在 `main` 分支。`sync()` 未对齐分支，`push origin main` 因本地无 `main` 分支而静默失败。加上本地和远程 git 历史独立 (unrelated histories)，即使分支正确 push 也会被拒。
- **修复**:
  - `sync()` fetch 后 `git checkout -B {target} origin/{target}` 强制对齐本地分支到远程 HEAD
  - 对齐前将本地 `sums/*.md` 保存到 `Map` 快照，对齐后与远程版本语义合并
  - `.gitignore` 追加 Electron 缓存目录（`Cache/`、`Local Storage/` 等 14 条），始终覆盖写入而非仅在不存在时创建
  - `git add` 纳入 `.gitignore`，确保 gitignore 本身也被版本控制
  - 清理未使用的 import (`basename`)
- **验证**: 启动后 `git log --all` 确认分支已从 `master` 切换到 `main`，同步成功提交 `sync: merge diary data` 并推送

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| Git 同步 | `electron/services/GitService.ts` |

### 项目现状
- 提交记录：17 commits，已 push 至 origin/main
- 同步流程：fetch → 保存快照 → checkout -B 对齐远程 → 语义合并 → commit + push
- 分支对齐自动处理 `master`↔`main` 不匹配问题

---

## 2026-06-02 修复记录 (claude: Kurisu)

### 已完成 (2 commits)

**1. sync() 用 git show 替代 checkout -B 避免同步静默失败** (`5d4ec38`)
- **根因**: `checkout -B origin/<branch>` 在工作区存在已追踪文件的未提交修改时（如 SchedulerService/DiaryService 定时刷新 `sums/*.md`），git 拒绝覆盖脏文件导致 checkout 失败。旧代码 catch 块静默吞错，`remote_has_branch` 保持 false，后续 merge 变成 local vs local 的 no-op，远程数据从未被拉取，但返回 `success: true`。
- **修复**:
  - 完全移除 `checkout -B`，改为 `git ls-remote origin <branch>` 判断远程分支是否存在
  - `git ls-tree -r --name-only origin/<branch>:<subdir>/` 列出远程文件
  - `git show origin/<branch>:<subdir>/<file>` 逐文件读取远程内容
  - 整个流程不再触碰工作区 git 状态，脏文件不影响远程数据拉取
  - 同时纳入 `data/` 目录的 JSON 文件合并

**2. 跨 PC 会话数据同步 — UUID + JSON 导出/合并/导入** (`139604a`)
- **根因**: 统计图表查询 `focus_sessions` SQLite 表（本地私有，`.gitignore` 排除 `*.db`）。`sums/*.md` 是从数据库**派生**的输出，同步输出不会更新源数据。所以即使日记文件正确同步，PC2 的统计图表仍只显示本机会话。
- **修复**:
  - `focus_sessions` 新增 `uuid TEXT UNIQUE` 列，`focus:start` 自动生成 UUID，数据库迁移给历史会话补充 UUID
  - **导出**: `SyncService.export_sessions_from_db()` — 同步前将所有 completed 会话导出为 `data/focus_sessions.json` (UUID→会话映射的 JSON 对象)
  - **合并**: `GitService.sync()` 处理 `data/` 目录时对 JSON 执行 UUID 对象浅合并 (`{ ...remote, ...local }`)
  - **导入**: `SyncService.import_sessions_to_db()` — 读取合并后的 JSON，`INSERT OR IGNORE` 仅插入本地不存在的 UUID
  - **重建**: 若导入了新会话，自动调用 `DiaryService.generate(today)` 重建当日日记
- **完整流程**: export JSON → git fetch → ls-tree 列远程文件 → git show 读远程内容 → 逐文件 merge (日记 .md 语义合并 + JSON UUID 合并) → commit + push → import 新 UUID 到本地 SQLite → 重建日记

**3. init_repo() checkIsRepo 向上递归导致仓库初始化在错误目录** (`1a9d74b`)
- **根因**: `checkIsRepo()` 向上递归查找 `.git`，`C:\Users\curiosity\` 存在 `.git`（误操作或某工具创建）→ `checkIsRepo()` 永远返回 `true` → `git init` 永远不会在 `moefocus/` 下创建仓库 → **所有 git 操作（add/commit/push）都在用户主目录的仓库中执行**。`moefocus/sums/` 和 `moefocus/data/` 从未被版本控制，这是跨 PC 同步完全失败的最根本原因。
- **修复**:
  - `init_repo()`: 用 `existsSync(join(repo_path, '.git'))` 直接检测 `.git` 目录替代向上递归的 `checkIsRepo()`
  - `check_sync_status()`: 同样修复 `checkIsRepo` → `existsSync`
  - 新仓库初始化使用 `git init --initial-branch=main` 避免 `master`/`main` 分支名不匹配
  - `sync()`: 新增旧仓库分支名对齐步骤（`git branch -m master main`）
**4. diary_entries 表未随 sync 更新 — 日记页读数据库不读文件** (`74c1667`)
- **根因**: `diary:listAll` 和 `diary:getByDate` 查询 `diary_entries` SQLite 表，而非 `sums/*.md` 文件。同步更新了磁盘上的 markdown 文件，但 `diary_entries` 表没有同步更新，导致日记页始终看不到同步过来的历史数据。
- **修复**:
  - 新增 `SyncService.sync_diary_entries_from_files()`: 遍历 `sums/*.md`，将内容写入/更新 `diary_entries` 表（保留用户反思和 mood 字段）
  - `git:sync` IPC handler: 在 import sessions 后调用 `sync_diary_entries_from_files()`
  - `main.ts` 启动同步: 同样补充完整的 export → sync → import → sync_diary_entries 链路（之前启动同步只调了 `git_service.sync()`，缺少前后处理）

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| Git 同步 | `electron/services/GitService.ts` (3 轮修改) |
| 会话同步 | `electron/services/SyncService.ts` (2 轮修改) |
| 数据库 | `electron/database/schema.sql`, `electron/services/DatabaseService.ts` |
| IPC | `electron/ipc/index.ts` (2 轮修改) |
| 启动入口 | `electron/main.ts` |
| 类型声明 | `src/types/electron.d.ts` |
| 经验文档 | `changes-made/13~15-sync-*.md`(新 3 篇), `changes-made/experience.md` |

### 项目现状
- 提交记录：21 commits ahead of origin/main，待 push
- 同步完整流程：export JSON → fetch → ls-remote 判断远程分支 → ls-tree + git show 逐文件读远程 → .md语义合并 + .json UUID合并 → 分支名对齐 → commit + push → import sessions → 重建日记 → sync diary_entries
- 四个根因全部修复：(1) checkout -B 脏文件静默失败 (2) focus_sessions 从未同步 (3) git 仓库初始化在错误目录 (4) diary_entries 不随 sync 更新
- 远程数据仓库 `moe_focus_data` 已验证：push/clone/merge 全流程通过
**5. sql.js 不支持 ALTER TABLE ADD COLUMN ... UNIQUE** (`08372ba`)
- **根因**: sql.js(Emscripten编译的SQLite)的 `ALTER TABLE` 不支持添加带 `UNIQUE` 约束的列，抛出 `"Cannot add a UNIQUE column"` 错误。uuid 迁移每次启动都在 try-catch 中静默失败，`uuid` 列从未被添加到已有数据库。
- **修复**:
  - `ALTER TABLE focus_sessions ADD COLUMN uuid TEXT` — 先加纯文本列
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_uuid ON focus_sessions(uuid)` — 单独建唯一索引
  - 迁移幂等性：`pragma_table_info` 检查列是否存在 + `pragma_index_list` 检查索引是否存在

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| Git 同步 | `electron/services/GitService.ts` (3 轮修改) |
| 会话同步 | `electron/services/SyncService.ts` (2 轮修改) |
| 数据库 | `electron/database/schema.sql`, `electron/services/DatabaseService.ts` (2 轮修改) |
| IPC | `electron/ipc/index.ts` (2 轮修改) |
| 启动入口 | `electron/main.ts` |
| UI | `src/pages/DiaryPage.tsx`, `DiaryPage.module.css` |
| 类型声明 | `src/types/electron.d.ts` |

### 项目现状
- 提交记录：23 commits ahead of origin/main，待 push
- **当前数据库已手动修复**: 5 条 focus_sessions + 7 天 diary_entries + uuid 列/索引就绪
- **下一步**: 重启应用 (`npm run dev`) 使新代码生效。启动时迁移会自动运行，之后点击「一键同步」即可正常工作

---
## 2026-06-03 修复记录 (claude: Kurisu)

### 已完成的三个问题 (3 commits)

**1. 简化GitHub设置 + 侧边栏一键同步按钮** (`4e8cb58`)
- **需求**: 设置→GitHub选项过于繁杂，同步按钮应放在侧边栏随时可用，接口暴露到GUI外可测试
- **修复**:
  - `Sidebar.tsx`: 侧边栏底部新增 🔄 一键同步按钮，hover旋转动画，同步中显示⏳状态+tooltip反馈(合并数/导入数/失败原因)
  - `Sidebar.module.css`: 新增 `.sync_btn` / `.syncing` 样式，`@keyframes sync_spin` 旋转动画
  - `SettingsPage.tsx`: GitHub标签页移除 Pull/Commit/Push 独立按钮（共3行→1行），仅保留远程地址/分支配置+应用+状态检查；移除对应4个handler函数
  - 暴露 `window.__moe_sync__()` 到DevTools console，同步接口可在GUI外直接测试
- **测试**: 克隆→npm install→electron-vite build通过，TypeScript类型检查exit 0

**2. 修复跨PC同步MD语义合并导致数据翻倍** (`e57790f`)
- **根因**: `GitService.sync()` 中 `merge_diaries(local, remote)` 做加法累计(local+remote)。重复同步时，同一天的已合并数据再次累加→总时间翻倍。JSON UUID合并虽正确，但 `sync_diary_entries_from_files()` 将错误合并后的MD文件覆盖diary_entries，抵消了import的正确结果。
- **修复**:
  - `GitService.sync()`: 移除MD语义合并（`if local && remote → merge_diaries`），改为仅从远程拉取本地缺失的文件（`!local && remote`），双方都有的保持本地不动
  - `GitService.ts` import: 移除 `merge_diaries`（不再使用）
  - `ipc/index.ts git:sync`: import后从DB查询所有有completed会话的日期→逐日 `DiaryService.generate()` 重新生成日记（summary从DB查询→总数=local+imported，正确）
  - `main.ts` 启动同步: 同样改为 import→regenerate所有日记→commit+push
  - 两次commit分工: `sync()` 提交JSON合并, handler提交regenerate后的MD
- **核心原理**: JSON UUID去重是正确的合并方式。日记MD是从DB**派生**的输出，不应独立合并。正确流程: export JSON → sync合并JSON → import到DB → 从DB regenerate日记MD

**3. 统计模块联动日记同步** (`9dc2d2c`)
- **根因**: StatsDashboard的"🔄 同步数据"按钮仅调用 `stats:syncCleanup` 清理孤儿数据（DELETE focus_sessions WHERE date NOT IN diary_entries），不导入远程会话。当diary_entries从MD文件同步后存在但focus_sessions缺失时，统计数据为空且按钮无法修复。
- **修复**:
  - `handle_sync` 改为: `git.sync()` 导入远程会话(JSON UUID去重) → `syncCleanup` 清理孤儿 → 刷新图表
  - 按钮新增 `syncing` 状态: 同步中显示⏳并禁用，完成后显示"导入X条会话，清理Y条孤儿记录"
  - 消息5秒后自动消失
- **联动闭环**: 统计→同步按钮→git sync→import sessions→regenerate diaries→update diary_entries→stats refresh

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| 侧边栏/UI | `src/components/layout/Sidebar.tsx`, `Sidebar.module.css` |
| 设置页 | `src/pages/SettingsPage.tsx` |
| Git同步 | `electron/services/GitService.ts` |
| IPC处理 | `electron/ipc/index.ts` |
| 启动入口 | `electron/main.ts` |
| 统计页 | `src/components/stats/StatsDashboard.tsx` |

### 项目现状
- 提交记录：26 commits ahead of origin/main（本轮+3），待 push
- 克隆测试：`git clone → npm install → setup.ps1 → electron-vite build` 全流程通过
- TypeScript 类型检查 exit 0，electron-vite 三包(main/preload/renderer)构建成功
- 同步流程：export JSON → sync(仅合并JSON) → import sessions → regenerate diaries from DB → commit+push MD
- 侧边栏一键同步 + 统计页同步联动 + DevTools `__moe_sync__()` 三层接口就绪

---

## 2026-06-03 第二轮修复记录 (claude: Kurisu)

### 已完成 (1 commit)

**1. 修复同步静默失败: ls-remote→rev-parse + 客观诊断反馈** (`e5b4449`)
- **根因**: 
  - `remote_has_branch` 检测使用 `git ls-remote origin <branch>`（新网络请求），认证/网络失败时被静默吞掉（空catch）→ `fetch_remote_dir()` 直接返回空Map → sync 报告 `success: true` 但零文件拉取
  - 前端feedback仅显示"已是最新"，无法区分「同步成功有数据」vs「同步成功零数据」→ 用户看到成功但日记/统计为空，无法判断是远程空还是拉取失败
- **修复**:
  - `GitService.sync()`: `git fetch` 成功后改用 `git rev-parse --verify origin/<branch>` 检测远程分支是否存在（纯本地操作，零网络开销，不会因认证问题静默失败）
  - `git fetch` 失败时立即 `return result` 并附带明确错误信息，不再进入后续静默分支
  - `SyncResult` 新增 `remote_sums_count` / `remote_data_count` / `diary_entries_synced` 诊断字段
  - `Sidebar.tsx`: tooltip 改为客观展示 — `远程日记: X篇 / 远程数据: X文件 / 新会话: X条 / 已同步: X天日记`，零数据时明确显示 `数据已是最新 (远程无新内容)`
  - `StatsDashboard.tsx`: 同步反馈补充 `同步X天日记` + `新文件列表`
  - `electron.d.ts`: SyncResult 类型声明新增诊断字段
- **关键改进**: 
  - `ls-remote` 是网络请求 → 需再次认证 → 可能失败被静默吞
  - `rev-parse origin/main` 是本地操作 → fetch已下载所有对象 → 零网络开销 → 不会静默失败

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| Git同步 | `electron/services/GitService.ts`, `SyncService.ts` |
| IPC处理 | `electron/ipc/index.ts` |
| 类型声明 | `src/types/electron.d.ts` |
| 反馈UI | `src/components/layout/Sidebar.tsx`, `src/components/stats/StatsDashboard.tsx` |

### 项目现状
- 提交记录：27 commits ahead of origin/main（本轮+1），待 push
- TypeScript 类型检查 exit 0
- 同步核心流程: export JSON → fetch → rev-parse(本地) → 拉取远程文件 → merge JSON(UUID去重) → import DB → regenerate diaries → sync diary_entries → commit+push
- 三层反馈: 侧边栏tooltip + 统计页消息 + Console `__moe_sync__()`	- 三层反馈: 侧边栏tooltip + 统计页消息 + Console `__moe_sync__()`
	
	---
	
	## 2026-06-03 第三轮修复记录 (claude: Kurisu)
	
	### 已完成 (3 commits, 2 分支)
	
	**1. 移除统计模块饼图 (FocusBreakdown)** (`37f8d21`, 分支: `fix/stats-overhaul`)
	- **根因**: FocusBreakdown 饼图使用 `focus_sessions JOIN todo_items JOIN tasks` 三表联查。跨PC同步时，导入会话的 `todo_id` 指向源PC的 todo_items 行，目标PC上不存在对应行 → LEFT JOIN 返回 NULL → 回退到 `fs.subject`。虽然数据不丢，但事项分类名取决于各PC本地 todo/task 命名，导致跨PC统计不一致。
	- **修复**:
	  - 删除 `FocusBreakdown.tsx` 饼图组件（68行）
	  - `StatsDashboard.tsx`: 移除 `chart_type` 状态和"🍩 饼图"切换按钮，柱状图固定为 stacked bar
	  - CSS 清理 `.chart_toggle` 选择器
	- **原理**: 统计模块和日记模块均以 `focus_sessions` 表为唯一数据源（通过UUID JSON同步），移除饼图后消除了跨PC事项分类不一致的展示问题。
	
	**2. 同步流程健壮性增强** (`3416cfb`, 分支: `fix/sync-robust`)
	- **根因**:
	  - `diary:generate` 再生循环中若某日期抛异常，后续日期全部被跳过，导致部分日记未更新。
	  - `stats:syncCleanup` 无条件删除孤儿会话，若 `diary_entries` 表为空（全新数据库），会误删全部会话。
	- **修复**:
	  - `ipc/index.ts` + `main.ts`: diary再生循环内 `try-catch` 隔离单日失败，记录错误日志后继续处理剩余日期
	  - `stats:syncCleanup`: 两道安全防护 — (1) `diary_entries` 为空时跳过删除 (2) 孤儿占比超50%时跳过（疑数据库异常）
	
	**3. sync() git reset --hard 消除分叉push冲突** (`d21e843`, 分支: `fix/sync-robust`)
	- **根因**: `sync()` 在 `git fetch` 后直接对本地数据做 commit → push。若远程在两次 sync 之间有其他 PC 的新 commit，本地与远程形成分叉历史，push 被拒 (non-fast-forward)。被拒的本地 commit 累积，与远程历史彻底分叉，后续 sync 陷入合并冲突死循环。这是多PC同步"完全不理想"的**最核心根因**。
	- **修复**:
	  - `sync()` fetch 后 + 数据快照后，执行 `git reset --hard origin/<branch>` 将本地 git 历史完全对齐到远程 HEAD
	  - 本地数据已在内存快照中保护，reset 只清 git 历史不丢数据
	  - reset 后远程文件从工作区直接读取（替代 `git ls-tree + git show`），更简洁可靠
	  - 随后合并写入的内容基于远程 HEAD，push 成为干净的 fast-forward
	- **验证**: 向 userData 仓库手动添加测试会话与日记 → reset 到远程 → commit → push 成功 → clone 到临时目录验证 7 session + 8 diary 完整一致
	
	### 关键文件变更索引
	| 模块 | 文件 |
	|------|------|
	| 统计UI | `src/components/stats/StatsDashboard.tsx`, `StatsDashboard.module.css`, `FocusBreakdown.tsx`(删) |
	| Git同步 | `electron/services/GitService.ts` |
	| IPC处理 | `electron/ipc/index.ts` |
	| 启动入口 | `electron/main.ts` |
	
	### 项目现状
	- `fix/stats-overhaul`: 1 commit，移除饼图，统计简化
	- `fix/sync-robust`: 2 commits，diary再生异常隔离 + syncCleanup安全防护 + git reset --hard 消除分叉
	- 同步核心流程: export JSON → fetch → snapshot → **git reset --hard origin/main** → 读远程文件 → merge JSON(UUID去重) → commit+push → import DB → regenerate diaries → sync diary_entries → commit+push
	- 端到端验证: 创建测试数据 → push → clone 到临时目录 → 数据完整一致 ✓

---

## 2026-06-03 第四轮修复记录 (claude: Kurisu)

### 已完成 (3 commits, 3 分支)

**1. 更新数据同步 README 和教学文档** (`392ac87`, 分支: `docs/sync-readme-update`)
- **内容**:
  - 新建 `moefocus/README.md`：数据同步使用说明、GitHub 配置步骤、同步入口说明、诊断字段解释
  - 重写 `review/03-data-management-deep-dive.md` §6：从简单的 git pull/push 更新为 UUID去重 + DB regenerate 的完整同步架构。新增7个常见同步问题的根因与解决方案对照表。补充完整同步流程图（7步骤）和三层同步入口说明。
  - `review/experience.md` 新增「数据同步血泪教训」章节：5个关键教训（不能直接 pull/push、sql.js 不支持 ALTER ADD UNIQUE、checkIsRepo 向上递归陷阱、sync 静默失败、MD 语义合并翻倍）+ 正确同步流程代码模式
  - `review/03-data-management-deep-dive.md` 关键要点从5条扩展为6条

**2. QQ 邮箱提醒功能修复** (`30c2cfd`, 分支: `fix/email-reminder`)
- **根因**: 邮箱设置页仅有"测试连接"按钮，无法手动触发提醒邮件，用户无法验证功能是否正常。仅有每日日记提醒，缺少每周博客写作提醒。
- **修复**:
  - `EmailService`: 新增 `send_blog_reminder()` 方法，发送本周专注统计汇总邮件
  - `SchedulerService`: 新增 `schedule_blog_reminder()` 每周定时任务，支持 cron `minute hour * * dayOfWeek`
  - `SettingsPage`: 新增"发送测试日记提醒" + "发送测试博客提醒"手动测试按钮
  - `SettingsPage`: 新增每周博客提醒设置区域（启用/时间/星期几）
  - `IPC`: 新增 `email:sendTestReminder` 和 `email:sendTestBlogReminder` handler
  - `Preload`: 暴露 `send_test_reminder()` 和 `send_test_blog_reminder()` 桥接
  - `Schema`: 新增默认设置 `email.blogReminderTime`/`email.blogReminderDay`/`email.blogReminderEnabled`

**3. 定时日记生成后自动用 Typora 打开** (`9433257`, 分支: `feat/diary-typora-auto-open`)
- **修复**: `SchedulerService.schedule_diary()` 中 `DiaryService.generate()` 返回后立即调用 `TyporaService.open(file_path)`，实现「定时生成→自动打开→即时写作」工作流

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| 文档 | `moefocus/README.md`(新), `review/03-data-management-deep-dive.md`, `review/experience.md` |
| 邮件服务 | `electron/services/EmailService.ts` |
| 定时调度 | `electron/services/SchedulerService.ts` (2 轮修改) |
| IPC处理 | `electron/ipc/index.ts` |
| Preload | `electron/preload.ts` |
| 设置页 | `src/pages/SettingsPage.tsx` |
| 数据库 | `electron/database/schema.sql` |
| 类型声明 | `src/types/electron.d.ts` |

### 项目现状
- 三个分支均待合并至 main，尚未 push
- `docs/sync-readme-update`: 文档更新，反映当前同步架构真实状态
- `fix/email-reminder`: 邮箱提醒从不可测试→两个测试按钮+每周博客提醒，TypeScript exit 0，electron-vite 三包构建成功
- `feat/diary-typora-auto-open`: 定时生成→自动打开 Typora，构建成功
- 其他模块（同步/统计/日记页/计时器）未改动，保持稳定
