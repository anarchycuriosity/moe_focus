# 11 - 日记反思同步合并去掉多余小标题

## 问题背景

用户反馈：如果同一天在多个时刻、甚至多台电脑上写了日记并同步，系统把不同版本的自我反思合并时插入了很多“同步前”“本地反思”“远程反思”之类的小标题。

这些标题对最终日记来说太冗余。用户期望的行为更简单：

1. 如果两边内容不同，就把新内容空行接到后面。
2. 不额外插入同步提示。
3. 不额外插入“本地/远程”小标题。
4. 如果一方已经包含另一方，就不要重复叠加。

## 修改位置

文件：

```text
moefocus/electron/services/SyncService.ts
```

函数：

```ts
merge_diary_manual_content(local_md, remote_md, filename)
```

## 修复方式

原逻辑在两边都有真实反思且内容不同时，会生成：

```markdown
<!-- MoeFocus 同步提示... -->

### 本地反思（同步前 xxx）

...

### 远程反思（同步前 xxx）

...
```

本轮改为：

```markdown
本地反思

远程反思
```

仍然保留以下去重逻辑：

1. 两边都空：保留本地。
2. 本地有、远程空：保留本地。
3. 本地空、远程有：使用远程。
4. 两边相同：只保留一份。
5. 本地包含远程：保留本地。
6. 远程包含本地：保留远程。
7. 两边都不同：本地在前，远程空行追加到后面。

## 关于外部删除某天日记

用户询问：如果想删除某天日记，是否可以在应用外部 pull 数据仓库，删除 `sums/YYYY-MM-DD.md`，push，再在本地也删除，然后同步。

结论：这只能删除 Markdown 展示文件，不能保证应用层彻底删除这一天。

原因：

1. `sums/YYYY-MM-DD.md` 是日记展示文件。
2. 真实专注数据仍然在 SQLite 的 `focus_sessions` 表里。
3. 同步流程会导入 `data/focus_sessions.json`。
4. 导入后 `DiaryService.generate()` 可能根据会话数据重新生成该日期日记。
5. `diary_entries` 表里也可能仍然保留该日期记录。

更稳妥的删除方式是使用应用内日记删除入口，因为它会级联清理同日期 `focus_sessions`、`diary_entries` 和对应 `sums` 文件。

如果确实要外部操作，需要同时确认：

1. 数据仓库里的 `sums/YYYY-MM-DD.md` 已删除。
2. 数据仓库里的 `data/focus_sessions.json` 中对应日期会话也不再存在。
3. 本机 SQLite 中对应日期的 `focus_sessions` 和 `diary_entries` 已清理。

否则下一次同步或重新生成时，那一天很可能又出现。

## 验证

已执行：

```powershell
cd moefocus
npm run build
```

结果：构建通过。
