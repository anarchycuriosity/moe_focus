我们正在做一个叫MoeFocus的日记+专注时间统计的专注钟，类似windows的专注钟但有一些新功能集成。我们现在主要先做moefocus文件夹下的桌面端部分，moefocus-mobile文件夹下的移动端先不管。现在部分模块已经比较稳定了，但有以下问题。

0：对以下的更改都要用git追踪各个步骤，方便reset。

1：侧边栏设置的默认专注时间设置不生效。

2：时钟倒计时有一个不必要的准备时间倒计时，删掉这个功能。

3：侧边栏统计模块，柱状图不只是要统计时间，而是要看到每天每个事项都花了多少时间，在同一条柱子上用不同颜色块显示出来。在月统计中，如果有同名的任务就合并统计时间，比如第一天有abc三个任务，第二天有ade三个任务，那么在月统计中a会加上这两天的a的计时。

4：自定义壁纸异常，无法看到自定义壁纸，工作原理不明。

5：readme要及时更新。

6：日记部分的大图不能正常显示，也没有readme部分提示怎么自定义。

7：把GUI的卡片部分尝试改成类似毛玻璃那种方便看到壁纸的效果，不一定是毛玻璃效果，但一定要方便看到壁纸。

---

## 2026-05-31 修复记录 (claude: Kurisu)

### 已完成修改 (5 commits)

**1. 计时器核心修复** (`be1b921`)
- idle/completed 状态不再显示倒计时圆圈，只显示 ⏱️/🎉 图标
- `end_session` 将 phase 设为 `completed` 而非重置 `remaining_seconds` 为满值，避免看起来像自动重启
- 新增 `completed` 阶段，专注完成后清晰显示"专注完成"
- 删除跳过按钮和 rest 自动切换逻辑
- 修复 `focus:complete` SQL — `SET status != 'running'` → `SET status = 'completed'`

**2. 统计图表修复** (`be1b921`)
- `WeeklyChart`：修复 `dayjs.add()` 可变性导致日期累加偏移的 bug（25→26→28→31...）
- `MonthlyChart`：过滤掉默认无意义 "专注" 条目
- 周/月统计使用堆叠柱状图，按事项分色，同名任务合并

**3. 壁纸按侧边栏切换** (`011c866`)
- `wallpapers/` 下按 `today|diary|statistics|settings.png` 命名对应 4 个侧边栏页面
- 新增 `file:getWallpaperForPage` IPC handler
- 切换页面时 CSS opacity 0.4s 渐变过渡
- `registerAllHandlers` → async

**4. 日记相框轮换** (`828eef2`)
- 从 `diary-pictures/` 自动加载所有图片
- 支持淡入淡出过渡动画
- 设置 → 通用 → 日记相框：可调轮换间隔(3-120s, 默认8s)和开关
- 新增 `file:getDiaryPictures` IPC handler

**5. UI 毛玻璃 + 设置默认值** (`ba57a21`)
- MoeCard / TaskCard / TodayTaskItem / Sidebar / TitleBar 降低不透明度(0.4-0.55)，增强 blur(10-14px) + saturate(150%)
- SessionConfig 挂载时从 settings 加载默认专注时长
- 日记页大图从 wallpapers 表读取

### 关键文件变更索引
| 模块 | 文件 |
|------|------|
| 计时器 | `src/store/useFocusStore.ts`, `src/hooks/useFocusTimer.ts`, `src/components/timer/*` |
| 统计 | `src/components/stats/WeeklyChart.tsx`, `MonthlyChart.tsx`, `electron/ipc/index.ts` |
| 壁纸 | `src/components/layout/AnimeBackground.tsx`, `AnimeBackground.module.css` |
| 相框 | `src/pages/DiaryPage.tsx`, `DiaryPage.module.css`, `SettingsPage.tsx` |
| UI | `src/components/common/MoeCard.module.css`, `*/*.module.css` |
| IPC | `electron/ipc/index.ts`, `electron/preload.ts`, `electron/main.ts` |

### 项目现状
- 壁纸文件夹：`moefocus/wallpapers/` (today/diary/statistics/settings.png)
- 日记图片：`moefocus/diary-pictures/` (4张截图)
- 提交记录：5 commits ahead of origin/main，待 push