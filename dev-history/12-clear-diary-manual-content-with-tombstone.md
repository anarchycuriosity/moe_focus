# 12 - 清空日记自定义总结并阻止同步拉回旧反思

## 问题背景

用户发现：当同一天在多个时间点或多台电脑上写过自定义反思后，即使手动删掉某段反思，同步仍可能把远程旧内容拉回来，导致日记越来越臃肿。

这不是简单的文本覆盖问题，而是同步语义问题：

```text
空内容 = 从来没写过？
空内容 = 写过，但现在明确删除？
```

如果同步算法无法区分这两者，就会把“本地空、远程有内容”理解为“本地缺失，应恢复远程内容”，于是删掉的反思会再次出现。

## 为什么需要清空标记

为了解决这个问题，需要一个同步层面的“删除意图”。

本轮使用 Markdown 注释作为清空标记：

```markdown
<!-- moe:reflection:cleared -->
```

它不是隐形按钮，也不是用户入口。真正的用户入口是日记页里可见的“清空自定义总结”按钮。

这个标记的作用是告诉同步算法：

```text
这一天的自定义总结不是没写过，而是用户明确清空过。
```

因此后续同步时，如果另一台电脑或远端仓库里还有旧反思，系统也不会再把旧反思合并回来。

## 实现方式

### 1. 同步层

文件：

```text
moefocus/electron/services/SyncService.ts
```

新增逻辑：

1. `reflection_clear_marker`
2. `has_reflection_clear_marker()`
3. `strip_reflection_clear_marker()`
4. `get_cleared_reflection()`

合并规则：

1. 如果本地或远程任意一方带有清空标记，最终结果保持清空。
2. 如果两边都没有清空标记，仍按原规则合并。
3. 两边都有不同反思时，只用空行拼接，不加“本地/远程”小标题。

### 2. 日记服务层

文件：

```text
moefocus/electron/services/DiaryService.ts
```

新增：

```ts
DiaryService.clear_manual_content(date)
```

行为：

1. 读取指定日期的日记 Markdown。
2. 只替换 `## 💭 自我反思` 区域。
3. 写入清空标记和默认占位符。
4. 保留统计区和当天专注数据。
5. 写回前生成 `.bak` 备份。
6. 同步更新 `diary_entries.summary_text`，并清空旧的 `reflection_text`。

### 3. IPC 与前端

新增 IPC：

```text
diary:clearManualContent
```

新增前端 API：

```ts
window.electronAPI.diary.clear_manual_content(date)
```

日记页新增可见按钮：

```text
清空自定义总结
```

用户点击后会出现确认弹窗，说明：

1. 统计区不会删除。
2. 专注数据不会删除。
3. 后续同步不会再拉回旧反思。
4. 如需恢复，可从 `.bak` 或 Git 历史手动找回。

## 验证

已执行：

```powershell
cd moefocus
npm run build
```

结果：

- main 构建通过。
- preload 构建通过。
- renderer 构建通过。
- TypeScript 编译通过。

追加验证：

1. 使用 `2099-01-01` 和 `2099-01-02` 两个测试日期写入临时日记。
2. 对两个测试日期执行“清空自定义总结”等价逻辑。
3. 确认清空后包含 `<!-- moe:reflection:cleared -->`。
4. 确认原测试反思文本已不存在。
5. 测试结束后删除两个测试日期的 Markdown、备份文件和数据库记录。

结果：

```text
2099-01-01: CLEAR_OK
2099-01-02: CLEAR_OK
TEST_DATES_CLEANED
```

本轮还修复了一个前端误报问题：清空成功后会尝试打开 Typora。如果 Typora 自动打开失败，不应该把清空操作本身显示成失败。现在打开 Typora 失败只会显示“已清空，但 Typora 未能自动打开”。

## 后续注意

这个按钮不是“删除整天日记”。它只清空用户自定义总结/反思区域。

如果要删除整天数据，仍然应该使用更强的日记删除逻辑，因为那会涉及：

1. `sums/YYYY-MM-DD.md`
2. `diary_entries`
3. `focus_sessions`
4. 同步仓库中的 `data/focus_sessions.json`

本轮只解决“我不想要这天的自定义总结了，不要同步再把它拉回来”的问题。



## 追加bug_01

日记的备份在这条路径下

C:\Users\curiosity\AppData\Roaming\moefocus\sums

你的清除和同步数据应该不是语义级别的吧，现在bug描述是：当我清空当天的自定义内容，点击同步，再次在本地写入内容后，点击同步，这次日记写的内容再次被清空覆盖。清空自定义内容后应该会给予再次修改和添加内容的机会。
