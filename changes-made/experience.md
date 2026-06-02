# MoeFocus 问题修复经验总结

## 本次修复概览 (2026-05-31)

修复了 MoeFocus 桌面端 7 个问题，涉及前端状态管理、IPC 通信、SQL 查询、CSS 样式、图表组件重写等多个层面。

## 关键技术要点

### 1. 数据流完整性检查

设置功能的经典陷阱：写入端正常工作，但读取端没有消费数据。

- **教训**：每添加一个设置项，必须同时确认 (a) 写入到了哪里 (b) 谁在什么时候读取它 (c) 是否有默认值 fallback
- **模式**：`SettingsPage(写) → DB → SessionConfig(读) → Store(应用)` 的完整链路
- **调试技巧**：在关键节点打 `console.log` 追踪数据流

### 2. SQL 语法警觉

在 `focus:complete` 中发现了 `SET status != 'running'` 的 bug：
- `!=` 是比较运算符，`=` 才是赋值
- `SET a != b AND c != d` 会被解析为布尔表达式而非赋值
- 这类 bug 的隐蔽性在于 SQLite 不会报语法错误，只是静默地不更新数据

### 3. CSS 简写属性的覆盖陷阱

`background: gradient(...)` 与 `background-image: url(...)` 的冲突：
- `background` 简写会重置所有 `background-*` 长写属性
- 即使内联样式设置了 `backgroundImage`，如果 CSS 规则中使用 `background` 简写可能在特定时机覆盖
- **规则**：设置默认背景图时使用 `background-image` 而非 `background`

### 4. 过时 API 的渐进迁移

Electron 从 `protocol.registerFileProtocol` 迁移到 `protocol.handle`：
- `registerFileProtocol(callback)` → `protocol.handle(() => net.fetch())`
- 新 API 使用标准的 Response 对象，与 Web 标准对齐
- 迁移时注意路径格式：`file:///C:/path` (Windows) vs `file:///path` (Unix)

### 5. Recharts 堆叠柱状图的数据准备

堆叠柱状图的关键约束：
- 每条 Bar 需要 `stackId` 相同才能堆叠
- 数据结构需要展平：每个 category（事项）作为独立的 dataKey
- 颜色一致性：同一 subject 在所有柱子上必须使用相同颜色 → 需要预建 subject→color 映射表
- 月统计的合并逻辑：同名 subject → 累加秒数 → 在图表层合并而非 SQL 层

### 6. Glassmorphism 设计原则

毛玻璃效果不是简单降低透明度：
- `backdrop-filter: blur()` + `saturate()` 是关键
- 不透明度 0.45-0.55 是文字可读性与壁纸可见性的平衡点
- blur 值 10-14px 提供足够的模糊度
- `saturate(150-180%)` 补偿 blur 导致的色彩变灰
- 半透明白色边框 `rgba(255,255,255,0.35)` 提供微妙的边界感

## 项目架构认知

- **状态管理**：Zustand store 是单一真相来源，设置默认值的加载应在组件 mount 时完成
- **IPC 模式**：preload.ts 暴露类型安全的 API → ipc/index.ts 注册 handler → Service 层处理业务逻辑
- **Recharts**：适合中等复杂度的图表需求，堆叠柱状图需要前端数据转换
- **CSS Modules**：每个组件的样式隔离良好，全局主题变量在 `global.css` 中定义

---

## 第四轮修复 (2026-05-31)

### 7. npm 包安装成功 ≠ 应用可运行

Electron 的 npm 包和 Electron 二进制文件是分离的：
- npm 包通过 registry 下载（npm mirror 已覆盖）
- 二进制文件通过 `@electron/get` 从 GitHub Releases 下载（需要单独的 `ELECTRON_MIRROR` 环境变量）
- postinstall 脚本失败可能不阻断 `npm install` 返回 0

**教训**：
- `.npmrc` 的 `registry` 镜像 ≠ Electron 二进制镜像，国内环境需要两层镜像
- `npm_config_*` 透传机制：`.npmrc` 的 key 会被转为 `npm_config_<key>` 环境变量，但 `electron_mirror` 不是 npm 的内置 key，会产生 warning
- 环境变量 `ELECTRON_MIRROR` 是 `@electron/get` 的一级读取源，比 npm config 透传更可靠
- **安装脚本必须做验证而非盲信**：`npm install` 返回 0 后应检查关键文件是否存在

**调试技巧**：
- `DEBUG=* node node_modules/electron/install.js` 可以观察 `@electron/get` 的完整下载/缓存/解压流程
- `extract-zip` 在跨文件系统（WSL2→NTFS）场景性能极差，模拟测试时要注意环境差异

### 8. 暗色模式 CSS 的铁律：永不硬编码背景色

`select` 和 `time_input` 硬编码 `background: white`，暗色模式下浅色文字（`#E8E4F0`）在白底上对比度接近零。

**核心原则**：
- 所有背景色用主题 CSS 变量（`var(--moe-glass-*)`），让暗/亮模式自动切换
- 亮色特殊需求通过 `[data-theme]` 选择器覆盖，而非反过来
- `color-scheme: dark/light` 不仅影响 CSS，还控制浏览器原生控件（下拉菜单、日历选择器等）的渲染主题
- 毛玻璃背景上文字对比度需要比纯色背景高一档——底层壁纸的亮度和色相不可预测，需要安全边际
- 区分信息层级用 `opacity` 而非不同颜色变量：同一色相 + 不同透明度 = 和谐层级；不同色相 = 视觉碎片化

---

## 第五轮修复 (2026-05-31)

### 9. 绕过中间库，直接下载二进制

`@electron/get` 作为中间库增加了一层不确定性：镜像 URL 格式、SHA256 校验、网络超时重试均由库控制。当镜像下载失败时，无法判断是镜像源问题还是库的兼容性问题。

**教训**：
- Electron 的 npm 包和二进制完全解耦——npm 包走 registry，二进制走 GitHub Releases。设置 `ELECTRON_MIRROR` 只影响后者
- `@electron/get` 的 postinstall 失败不阻断 `npm install`，导致 `node_modules` 装好但 `electron.exe` 缺失的半成品状态
- **直接 HTTP 下载 zip 比依赖 postinstall 更可控**：一个 `Invoke-WebRequest` + `Expand-Archive` 解决问题
- 双 URL 兜底是网络不可靠环境的标配：npmmirror（国内快） → GitHub（稳定备用）
- 版本号必须从 `node_modules/electron/package.json` 读取确切版本，而非解析语义版本范围

**cmd 语法陷阱**：
- `&` 在 cmd 中是命令分隔符，`echo ... download & extraction` 会被拆成两条命令
- 嵌入 PowerShell 命令到 bat 文件时，管道符 `|` 在 cmd 双引号内仍保持特殊含义，必须用 `^|` 转义

---

## 第六轮修复 (2026-05-31)

### 10. 绕过 postinstall 不只是跳过下载，还需要复现其副作用

electron 包的 `install.js`（postinstall）做了三件事：**下载 zip → 解压到 dist/ → 写入 path.txt**。我们绕过它直接下载解压，遗漏了最关键的一步——`path.txt`。

**根因**：`electron-vite` 不依赖 `electron.exe` 是否存在，而是读取 `node_modules/electron/path.txt` 来定位可执行文件。这个隐蔽的间接层导致"二进制文件明明存在，但 electron-vite 报 Electron uninstall"。

**教训**：
- 绕过一个模块的安装脚本时，必须逆向理解该脚本的**全部副作用**，不仅仅是主要操作
- `path.txt` 是一个元数据文件，内容只有一行（如 `electron.exe`），但它是一个隐式契约——electron-vite、electron-builder 等工具链都依赖它
- **`Out-File -NoNewline` 至关重要**：`path.txt` 末尾的 `\n` 会被拼入路径，导致 `electron.exe\n` 找不到文件
- 验证方法：`xxd` 或 `Format-Hex` 检查尾部字节，确保无 `0d 0a` 或 `0a`

**调试技巧**：
- electron-vite 源码在 `node_modules/electron-vite/dist/chunks/lib-BmEkZIgk.mjs`，`getElectronPath()` 函数只有 ~20 行，直接阅读即可定位问题
- 模拟克隆环境是发现这类问题的唯一手段——当前开发环境的 postinstall 曾经成功过（残留了 path.txt），不会触发 bug
- 每次修改安装脚本后，必须在干净的克隆环境（无 node_modules、无缓存）中完整测试一次

---

## 第七轮修复 (2026-05-31)

### 11. 级联删除：数据库操作不是孤立的事务

删除日记时只删 `diary_entries` 行，同日期 `focus_sessions` 和 `sums/` 文件原封不动。统计查询只看 `focus_sessions` 表，与 `diary_entries` 无 JOIN — 所以删除日记后图表数据不变。

**根因**：两个表仅通过共享 `date` 字段隐式关联，没有外键约束，更没有级联删除语义。`DELETE FROM diary_entries` 不会触发任何副作用。

**思维出发点**：当两个实体通过业务逻辑关联（而非数据库外键），删除操作需要手动梳理级联范围：
- `focus_sessions` → 应该删除（专注数据是日记的组成部分）
- `todo_items` → 不应删除（待办事项是独立的任务规划，日期只是时间属性）
- `sums/YYYY-MM-DD.md` → 应该删除（磁盘文件是数据库内容的投影）

**教训**：
- 数据库操作不等于业务操作 — `DELETE FROM diary_entries` 只是第一步，还需要级联清理关联数据和磁盘文件
- 不依赖于用户手动比对 + 按钮 — 级联删除在 `diary:deleteEntry` 中一步到位，用户感知是「删了日记统计就少」
- `stats:syncCleanup` 作为兜底 — 处理历史残留的孤儿数据（在级联删除实现之前产生的），之后理论上不再产生
- **`refresh_trigger` 模式**：子组件用 `useEffect([dep, refresh_trigger])` 而非 `key` 强制重挂载，既触发刷新又不闪烁

**调试技巧**：
- `SELECT changes()` 是 SQLite 的内置函数，返回上一条 DML 语句影响的行数，非常适合返回给前端做 toast 消息
- TypeScript 类型声明与实际 preload API 不同步是常见坑 — 补 `sync_cleanup` 时顺便修了 `get_weekly_breakdown`/`get_monthly_breakdown` 的缺失声明

---

## 第八轮修复 (2026-06-02)

### 12. git checkout -B 不是无副作用的"对齐"操作

`git checkout -B <branch> origin/<branch>` 在语义上 = `git branch -f <branch> origin/<branch> && git checkout <branch>`。问题出在 checkout 这步：**若工作区存在已追踪文件的未提交修改，git 会拒绝覆盖这些脏文件**，checkout 直接失败。

在 MoeFocus 的同步场景中，`SchedulerService` 或 `DiaryService.generate()` 会定时刷新 `sums/*.md`，这些文件在前一次 sync 中被 commit+pushed，成为追踪文件。当前的修改使它们变成"脏文件"→ 下次 sync 的 checkout -B 试图用远程版本覆盖它们 → git 拒绝 → catch 块静默吞错 → 远程数据从未被拉取。

**思维出发点**：面对"对齐本地到远程"的需求时，第一个想到的可能是 checkout/reset，但这类操作修改工作区，必然与本地未提交修改冲突。**正确的思路是"不修改工作区就读到远程文件"**——`git show origin/<branch>:<path>` 能直接输出远程文件内容，完全绕开工作区冲突。

**教训**：
- `git checkout -B` 在有脏文件时会失败，不是万能的强制对齐
- catch 块不能静默吞错——至少应该记录 `console.error` 以便诊断
- `git ls-remote origin <branch>` 判断远程分支是否存在，比 try-catch `checkout` 更可靠
- `git ls-tree -r --name-only origin/<branch>:<subdir>/` 可以列出远程目录文件
- `git show origin/<branch>:<subdir>/<file>` 可以逐文件读取远程内容
- 整个新 sync 流程完全不触碰工作区 git 状态，脏文件不再是问题

**调试技巧**：
- 复现 PC2 同步失败：准备两台电脑，PC1 产生新日记并同步 → PC2 自动生成同日日记后点击同步 → 观察 remote 数据是否到达本地
- 检查 git 工作区状态：`git status` 看 `sums/*.md` 是否有未提交修改
- 验证 checkout -B 失败场景：在有脏追踪文件的仓库执行 `git checkout -B main origin/main`

---

### 13. 跨 PC 数据同步需要双向数据流，不是单向导出

同步 `sums/*.md` 日记文件只是把**输出**传到了另一台 PC，源数据 `focus_sessions` 表从未参与同步。统计图表查询的是源数据，所以即使日记文件正确同步，另一台 PC 的图表也不会反映远程会话。

**思维出发点**：当需要多节点数据一致性时，必须区分**源数据**（`focus_sessions` 表）和**派生数据**（`sums/*.md` 文件）。同步派生数据只能让展示层一致，不能让统计层一致——因为统计需要源数据的每条记录，而不是汇总结果。

**去重是分布式同步的核心难题**：多台 PC 独立产生数据，简单累加会导致同一条会话被重复计数。解决方法是给每条记录分配**全局唯一标识符 (UUID)**，合并时按 UUID 取并集，导入时用 `INSERT OR IGNORE` 跳过已存在的 UUID。

**教训**：
- UUID 是去重的基石——`crypto.randomUUID()` 在 Node 和浏览器中均可用
- JSON 以 UUID 为 key 的对象结构天然无冲突：`{ uuid: data }` 的浅合并就是取并集
- `INSERT OR IGNORE` 依赖 UNIQUE 约束——没有 UNIQUE 就不会触发 IGNORE
- 导出 → 文件合并 → 导入 的三段式比直接在 DB 层 merge 更解耦、更易调试
- 导入后必须重建派生数据（`DiaryService.generate()`），否则日记文件与数据库不一致
- export 必须走在 sync 之前——先把本地最新数据写入 JSON，再拉取远程进行合并
