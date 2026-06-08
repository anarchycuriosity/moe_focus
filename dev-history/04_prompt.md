我们正在做一个叫MoeFocus的日记+专注时间统计的专注钟，类似windows的专注钟但有一些新功能集成。我们现在主要先做moefocus文件夹下的桌面端部分，moefocus-mobile文件夹下的移动端先不管。修复记录的内容已经被修复了，现在部分模块已经比较稳定了，但有以下问题你需要修复（我提出的问题也要在下一轮修复中被补充到修复记录）。你对以下的每点内容都要分别建立新的分支并在那个分支进行提交，而不是改完所有才提交。**每次对话结束前必须按下方格式在本文末尾追加修复记录review，方便下次开新终端循环。**如果0x_prompt.md写的review过长了，就按序号新建一个0(x+1)prompt.md来review，这样只看最近修改的核心代码模块而不必回顾过多。



1：当专注钟挂在后台的时候计时异常，你检查项目对应的逻辑。

2：点击暂停后统计时间的逻辑是对的，但是暂停后前端显示异常，比如专注了10min，进度条消耗了部分，统计条积累了部分，但是暂停再开始后，进度条又从头开始跑。

---

## 本轮修复记录 review

### 分支 1：`codex/fix-background-focus-timer`

提交：`Codex: fix background focus timer drift`

修复问题：

1. 后台计时异常。
2. 原因是渲染进程使用 `setInterval` 每秒递减 `remaining_seconds`，窗口进入后台后计时器可能被 Chromium 节流。
3. 修复为记录当前阶段的绝对结束时间 `phase_end_time_ref`，每次 tick 时使用 `Date.now()` 重新计算剩余秒数。

核心文件：

- `moefocus/src/hooks/useFocusTimer.ts`
- `changes-made/01_background_focus_timer.md`
- `changes-made/experience.md`

验证：

- 已运行 `npm run build`，构建通过。

### 分支 2：`codex/fix-resume-progress-display`

提交：`Codex: keep focus progress after resume`

修复问题：

1. 暂停后继续，专注进度环从头开始跑。
2. 原因是继续时新建了剩余时长的数据库会话，并把 UI 的 `total_seconds` 改成了剩余时长。
3. 修复为新增 `session_start_remaining_seconds`，把“UI 总进度”与“当前数据库会话统计基准”分开。
4. 继续计时时保留原始 `total_seconds`，因此进度环不会重置；统计写入使用 `session_start_remaining_seconds - remaining_seconds`，避免重复计算。

核心文件：

- `moefocus/src/store/useFocusStore.ts`
- `moefocus/src/hooks/useFocusTimer.ts`
- `changes-made/02_resume_progress_display.md`
- `changes-made/experience.md`

验证：

- 已运行 `npm run build`，构建通过。

### 追加修复：点击暂停后无法暂停

提交：`Codex: fix pause control across timer instances`

修复问题：

1. `TodayPage` 和 `FocusPage` 都会创建 `FocusTimer`，原来的 interval 句柄保存在各自的 hook 实例里。
2. 如果在一个页面开始计时，再在另一个页面点击暂停，暂停按钮清理不到真正运行中的 interval。
3. 修复为把 `interval_ref` 和 `phase_end_time_ref` 提升到 `useFocusTimer.ts` 的模块级变量，让所有 `useFocusTimer` 调用共享同一个计时器控制点。
4. 暂停时先切换前端状态到 `paused`，再异步写入数据库，避免 IPC 或数据库延迟造成“按钮没反应”的观感。

核心文件：

- `moefocus/src/hooks/useFocusTimer.ts`
- `changes-made/03_pause_button_not_working.md`
- `changes-made/experience.md`

验证：

- 已运行 `npm run build`，构建通过。
