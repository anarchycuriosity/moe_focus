# 07 - 9 号日记反思恢复与“生成今日”日期判断修复

## 问题现象

用户在 2026-06-09 写完日记自我反思后点击同步，随后发现 `2026-06-09.md` 的“自我反思”被恢复成空模板。

同时，在 2026-06-10 打开日记页时，点击“生成今日”仍提示 `2026-06-09` 日记已经存在，像是系统日期还停在 9 号。

## 排查过程

真实用户数据目录是：

```text
C:\Users\curiosity\AppData\Roaming\moefocus
```

当前日记文件位于：

```text
C:\Users\curiosity\AppData\Roaming\moefocus\sums\2026-06-09.md
```

检查 Git 历史后发现，数据仓库中可见的 `2026-06-09.md` 提交版本都只有空反思模板，不能直接从 Git 提交恢复。

继续搜索 Typora 自动恢复目录，找到两个草稿：

```text
C:\Users\curiosity\AppData\Roaming\Typora\draftsRecover\2026-6-9 2026-06-09 232128.md
C:\Users\curiosity\AppData\Roaming\Typora\draftsRecover\2026-6-9 2026-06-09 232204.md
```

这两个文件包含用户写过的自我反思内容，因此使用较新的草稿恢复反思正文，并保留当前日记文件里更新后的统计数据。

## 数据恢复结果

恢复前先保存了空反思版本：

```text
C:\Users\curiosity\AppData\Roaming\moefocus\sums\2026-06-09.md.recovered-empty-before-restore
```

恢复后的 `2026-06-09.md` 保留：

- 总专注时间：3 小时 35 分钟。
- 专注会话数：14。
- 事项时间分布：程设艺术、摸鱼开发、专注。
- 从 Typora 草稿找回的自我反思正文。

同时使用 `sql.js` 更新了 `moefocus.db` 中 `diary_entries.summary_text`，避免测试邮件或提醒邮件继续读取旧的空模板。

## “生成今日”根因

`DiaryPage.tsx` 中按钮文案是“生成今日”，但实际生成时调用的是：

```ts
window.electronAPI.diary.generate(target_date)
```

`target_date` 来自路由参数：

```ts
const target_date = date || dayjs().format('YYYY-MM-DD')
```

如果用户当前停留在 `/diary/2026-06-09`，那么即使真实日期已经是 2026-06-10，点击“生成今日”也会继续尝试生成 `2026-06-09`。

这不是系统时间错误，而是按钮语义和实现使用的日期来源不一致。

## 修复方案

在 `moefocus/src/pages/DiaryPage.tsx` 中新增 `generate_date` 状态。

点击“生成今日”时，立即用 `dayjs().format('YYYY-MM-DD')` 记录真实当天日期：

```ts
set_generate_date(dayjs().format('YYYY-MM-DD'))
```

确认生成时使用 `generate_date`，而不是路由里的 `target_date`。

这样即使用户正在查看 9 号日记，点击“生成今日”也会生成 10 号日记。

同时在 `moefocus/electron/services/DiaryService.ts` 做服务层保护：

1. 重新生成同日期日记前，先把旧 Markdown 复制为带时间戳的 `.bak` 文件。
2. 如果旧 Markdown 中“自我反思”不是默认占位符，则生成新统计内容时自动继承这段反思。
3. 这样即使入口绕过前端确认，例如定时生成、测试生成或后续 IPC 调用，也不容易再次把手写反思直接抹掉。

在 `moefocus/electron/services/GitService.ts` 的用户数据 `.gitignore` 规则中加入：

```text
*.bak
*.recovered-*
```

原因是这些文件属于本机恢复备份，不应该跟随 `sums/` 一起同步到远端数据仓库。

## 验证

执行构建：

```text
npm run build
```

结果：构建通过。

额外验证 SQLite：

```text
SELECT date, length(summary_text), instr(summary_text, '上午起的太晚')
FROM diary_entries
WHERE date = '2026-06-09';
```

结果显示 `summary_text` 中已经包含恢复后的反思正文。

## 后续风险

最初只靠前端覆盖确认是不够的。因为日记生成入口不止一个：

- 日记页手动生成。
- 设置页测试生成。
- 定时任务自动生成。
- 启动同步后的批量重新生成。
- 手动同步后的批量重新生成。

所以真正的修复边界必须下沉到 `DiaryService.generate()` 和 `GitService.sync()`。

## 追加修复：生成只更新统计区，不覆盖反思区

`DiaryService.generate()` 现在遵守以下规则：

1. 新日记会写入明确的程序生成区标记：

```markdown
<!-- moe:generated:start -->
...
<!-- moe:generated:end -->
```

2. 再次生成同一天日记时，只替换这两个标记之间的内容。
3. 标记之外的内容全部视为用户内容，包括自我反思、额外段落、后续手动追加的复盘。
4. 如果是旧格式日记，没有程序区标记，则生成时会迁移为“程序生成区 + 手写区”，并保留旧的 `## 💭 自我反思`。
5. 如果用户提前创建了当天 Markdown 并随手写内容，第一次生成会把原内容放进反思区，而不是直接覆盖。
6. 只有最终 Markdown 内容真的发生变化时，才写回文件。
7. 写回前自动生成 `.bak` 备份。
8. 比较内容时规范化 CRLF/LF，避免 Windows 换行差异导致反复备份。

这意味着用户可以随时打开 Typora 写日记。之后再次点击生成、定时生成或同步后重生成，都只会刷新统计区，不会把反思区改回模板。

## 追加修复：同步只合并人工内容，统计由 JSON 重新生成

`GitService.sync()` 中的 `sums/*.md` 合并逻辑调整为：

1. 本地没有、远程有：拉取远程日记。
2. 本地有、远程没有：保留本地日记。
3. 本地和远程都有：只合并 `## 💭 自我反思` 这一类人工内容。
4. 如果本地反思为空模板、远程有真实反思：使用远程反思。
5. 如果远程反思为空模板、本地有真实反思：使用本地反思。
6. 如果两边都有真实反思且内容不同：保留两份，并插入提示，让用户稍后手动整理。

统计区不再通过 Markdown 文本相加合并，因为重复同步会导致时间翻倍。正确来源是 `data/focus_sessions.json`，它以 UUID 去重；导入数据库后，再由 `DiaryService.generate()` 从完整会话集合重新生成统计区。

## 用户可见反馈

侧边栏同步按钮和统计页同步按钮现在都会在结果中显示“合并反思 N 篇”，方便用户知道哪些日记发生了人工内容合并，需要回头检查。

日记页生成弹窗的文案也同步调整：

- 不再使用“确认覆盖当天日记”。
- 不再提示“请先备份或取消本次操作”。
- 已存在日记时，提示改为“更新当天统计”。
- 说明继续生成只会刷新程序统计区，手写反思和额外内容会保留。

原因是底层已经通过程序区标记和自动备份提供保护，前端不应该再用旧的覆盖式描述误导用户。

后续建议：

1. 给日记 Markdown 引入更明确的区块标记，例如 `<!-- moe:stats:start -->` 和 `<!-- moe:reflection:start -->`。
2. 将“反思区”视为一等数据，未来可以单独导出为 JSON，Markdown 只作为展示格式。
3. 增加自动化测试，覆盖“本地有反思、远程空模板、同步后反思仍存在”的场景。
