# 08 - 邮件提醒按每日目标完成度切换语气和标题

## 问题背景

用户希望邮件提醒标题不要再使用固定的系统式标题，而是根据当天专注目标完成度分成三档：

1. 当天专注总时间达到每日目标的 80% 及以上：使用赞美语气。
2. 当天专注总时间达到每日目标的 60% 到 80% 之间：使用中性提醒。
3. 当天专注总时间低于每日目标的 60%：使用责备提醒。

邮件标题需要使用：

```text
praise from Akane
neutral from Akane
blame from Akane
```

这类格式。其中角色仍然从文案库随机抽取，`Akane` 代表该角色的罗马音署名。

## 处理思路

上一轮已经在 `reminder_text_library.ts` 中为每个角色提供了 3 条日记提醒和 3 条博客提醒。本轮先不大规模重写文案，而是把每个角色的 3 条日记提醒按顺序解释为：

1. 第 1 条：`praise`
2. 第 2 条：`neutral`
3. 第 3 条：`blame`

发送每日日记提醒时：

1. 先随机选择角色。
2. 再根据当天完成度选择该角色对应档位的文案。
3. 邮件标题使用 `${tone} from ${signature_name}`。
4. 邮件正文显示当天日期、专注完成度、角色风格提醒、日记摘要。

## 数据来源

完成度不从日记 Markdown 解析。

原因：

1. 最近日记逻辑刚改为“程序生成区 + 用户手写区”，Markdown 主要承担展示和人工记录职责。
2. 专注数据真实来源是 SQLite 的 `focus_sessions` 表。
3. 每日目标真实来源是 `settings` 表中的 `focus.dailyGoal`。
4. 继续从 Markdown 反推完成度容易和刚修好的反思保留逻辑互相干扰。

当前计算公式：

```text
ratio = 当天 completed 会话 actual_duration_sec 总和 / (focus.dailyGoal * 60)
```

分档规则：

```text
ratio >= 0.8  -> praise
ratio >= 0.6  -> neutral
ratio <  0.6  -> blame
```

## 修改文件

- `moefocus/electron/services/reminder_text_library.ts`
  - 新增 `ReminderTone` 类型。
  - `select_random_reminder(kind, tone)` 支持按语气档位选择同角色对应文案。

- `moefocus/electron/services/EmailService.ts`
  - 新增 `DailyFocusProgress`。
  - 每日日记提醒标题改为 `${tone} from ${signature_name}`。
  - 邮件正文显示 `今日完成度：已完成 / 目标 分钟（百分比）`。

- `moefocus/electron/services/SchedulerService.ts`
  - 定时日记提醒和测试日记提醒都会计算当天完成度。
  - 计算口径与桌面端每日目标环保持一致：只统计 `status = 'completed'`。

- `moefocus/electron/ipc/index.ts`
  - `email:sendReminder(date)` 入口也补充完成度计算，避免绕过新标题规则。

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

当前只是把已有三条文案映射到三档语气。后续如果要更精细，可以逐角色重写为明确字段：

```ts
diary: {
  praise: {...},
  neutral: {...},
  blame: {...}
}
```

这样语义会比“数组第几项代表哪种语气”更稳定。
