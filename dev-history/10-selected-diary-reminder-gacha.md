# 10 - 设置页邮箱增加指定日期日记提醒抽取

## 问题背景

用户希望在 `设置 -> 邮箱` 中增加一个入口，可以选择最近某一天的日记，然后发送那一天的日记提醒邮件。

目标不是单纯测试 SMTP，而是增加一点“抽奖”的乐趣：

1. 从最近已有日记中选择特定日期。
2. 每次发送都重新随机抽取一个角色。
3. 邮件主题仍然使用 `praise from xxx` / `neutral from xxx` / `blame from xxx`。
4. 语气档位根据所选日期当天的专注完成度判断。
5. 邮件内容使用所选日期的日记内容。

## 处理思路

此前已有 IPC：

```ts
email:sendReminder(date)
```

但它主要用于按日期发送正式提醒，设置页没有给用户提供选择历史日期的 UI。本轮复用该 IPC，并在设置页增加最近日记下拉框。

为了避免再次引入“日记生成”和“邮件发送”混在一起的问题，本轮保持以下边界：

1. 不调用 `DiaryService.generate()`。
2. 不修改日记 Markdown。
3. 不写数据库。
4. 只读取 `diary_entries` 中已有的日记记录。
5. 优先读取 `file_path` 指向的 Markdown 文件；文件不存在时再回退到 `summary_text`。

## 修改文件

- `moefocus/electron/ipc/index.ts`
  - `email:sendReminder(date)` 改为查询 `summary_text, file_path`。
  - 优先读取指定日期的 `.md` 文件内容。
  - 若该日期没有日记记录，返回错误。

- `moefocus/src/pages/SettingsPage.tsx`
  - 初始化设置时同时加载 `diary.list_all()`。
  - 新增最近 14 篇日记日期下拉框。
  - 新增“抽取角色并发送”按钮。
  - 点击后调用 `window.electronAPI.email.send_reminder(selected_reminder_date)`。

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

## 后续建议

1. 如果希望抽奖感更强，可以在发送成功后回传本次抽到的角色和语气，在设置页显示“本次抽到：Akane / blame”。
2. 如果日记数量很多，可以把最近 14 篇改为最近 30 篇，或者增加日期搜索。
3. 如果未来把手写反思单独 JSON 化，提醒邮件应继续优先读取最终 Markdown 展示文件。
