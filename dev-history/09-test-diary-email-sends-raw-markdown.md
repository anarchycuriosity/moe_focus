# 09 - 测试日记邮件改为直接发送当天 Markdown 原文

## 问题背景

用户测试“发送测试日记提醒”时，发现邮件标题没有出现预期中的 `praise from Akane` 这类格式。

继续确认需求后，用户明确指出：测试日记邮件不应该走正式提醒逻辑。

测试日记邮件的目标应该是：

1. 只验证 QQ 邮箱配置和当天日记文件读取是否正常。
2. 直接发送当天已经存在的日记 Markdown。
3. 不重新生成日记。
4. 不计算每日目标完成度。
5. 正文不要出现完成度统计。
6. 邮箱收件箱主题仍然使用正式提醒同款 `praise from xxx` / `neutral from xxx` / `blame from xxx`。

## 根因

设置页的“发送测试日记提醒”调用：

```ts
window.electronAPI.email.send_test_reminder()
```

底层 IPC 委托给：

```ts
scheduler_service.trigger_email_now()
```

上一轮为了让正式提醒支持 `praise / neutral / blame from xxx`，把 `trigger_email_now()` 也接入了完成度计算和角色提醒模板。

这导致测试邮件和正式提醒共用同一条策略路径，测试邮件也被错误地加入了完成度逻辑。

## 修复方案

本轮把测试邮件和正式提醒分离：

1. `EmailService.send_reminder()`
   - 保持正式提醒逻辑。
   - 继续支持完成度分档。
   - 继续使用 `praise from xxx`、`neutral from xxx`、`blame from xxx` 标题。

2. `EmailService.send_diary_test()`
   - 新增测试日记邮件专用方法。
   - 邮箱主题统一为 `${tone} from ${signature_name}`。
   - 正文直接展示 Markdown 原文。
   - 不显示完成度。
   - 不在正文里使用测试用标题。

3. `SchedulerService.trigger_email_now()`
   - 改为读取 `diary_entries.file_path`。
   - 使用 `fs.readFileSync()` 读取当天 `.md` 文件。
   - 为邮件主题计算当天完成度分档，但不把完成度写入正文。
   - 如果文件不存在，直接返回错误：

```text
今日日记 Markdown 文件不存在，请先生成今天的日记
```

这样测试入口不会隐式调用 `DiaryService.generate()`，也不会从数据库 `summary_text` 读旧缓存。

## 修改文件

- `moefocus/electron/services/EmailService.ts`
  - 新增 `send_diary_test()`。

- `moefocus/electron/services/SchedulerService.ts`
  - `trigger_email_now()` 改为发送当天 Markdown 原文。
  - 新增 `existsSync` 和 `readFileSync` 读取文件。

## 验证要点

后续在应用中点击“发送测试日记提醒”时，应看到：

1. 邮件主题为：

```text
praise from Akane
```

2. 正文直接包含当天 `.md` 内容。
3. 正文没有“今日完成度”。
4. 主题会根据当天完成度变成 `praise from xxx` / `neutral from xxx` / `blame from xxx`。
5. 如果当天还没有生成日记，应显示发送失败，而不是自动生成。
