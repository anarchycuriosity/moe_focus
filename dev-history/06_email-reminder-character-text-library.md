# 06 - 邮件提醒文案库：让日记和博客提醒更像有人在认真叫你回来

## 问题背景

用户反馈：每日日记提醒和每周博客提醒的邮件正文太冰冷，像系统通知，不像真正会让人愿意打开 Typora、继续写反思或博客的提醒。

用户希望：

1. 提醒内容更长一些。
2. 每天从提前写好的文本库中随机抽取。
3. 文案参考用户喜欢的动画角色气质。
4. 不要在开头生硬自我介绍。
5. 只在结尾使用类似 `from Kurisu` 的罗马音署名。

## 处理思路

原有实现把邮件正文直接写死在 `EmailService.ts` 中：

- `send_reminder()` 负责每日日记提醒。
- `send_blog_reminder()` 负责每周博客提醒。

这种写法的问题是：

1. 邮件服务逻辑和文案内容耦合，后续增加文本会让 SMTP 代码越来越臃肿。
2. 每次邮件内容固定，长期使用会疲劳。
3. 原邮件只是在“通知”，缺少陪伴感和行动引导。

本轮改为：

1. 新增独立文本库 `reminder_text_library.ts`。
2. 每个角色维护 3 条日记提醒和 3 条博客提醒。
3. 发送邮件时随机选择角色，再随机选择该角色对应类型的一条文本。
4. 邮件开头直接进入提醒内容，不做“我是某某”的自我介绍。
5. 邮件正文末尾使用 `from Haruhi`、`from Kurisu` 这类署名。
6. 对日记摘要和统计摘要做 HTML 转义，避免用户内容中的 `<`、`&` 等字符破坏邮件结构。

## 修改文件

- `moefocus/electron/services/reminder_text_library.ts`
  - 新增角色文案库。
  - 导出 `select_random_reminder(kind)`。
  - 返回标题、正文、署名、主题色。

- `moefocus/electron/services/EmailService.ts`
  - 引入随机文案库。
  - 每日日记提醒使用 `select_random_reminder('diary')`。
  - 每周博客提醒使用 `select_random_reminder('blog')`。
  - 邮件主题改为随机文案标题。
  - 邮件正文增加更长的角色风格提醒段落和 `from xx` 署名。
  - 新增 `escape_html()`，防止摘要内容破坏 HTML 邮件。

## 验证

已在 `moefocus` 目录执行：

```powershell
npm run build
```

结果：

- Electron main 构建通过。
- preload 构建通过。
- renderer 构建通过。
- TypeScript 编译通过。

## 后续注意

1. 文案为“角色气质启发”的自然提醒，不直接复制原作台词。
2. 如果后续希望某个角色出现频率更高，可以在文本库中增加权重字段，或重复放入角色配置。
3. 如果后续希望用户在设置中选择偏好角色，可以把 `select_random_reminder()` 改为接收候选角色列表。
4. 当前测试邮件和定时邮件都会走同一套随机文案逻辑。
